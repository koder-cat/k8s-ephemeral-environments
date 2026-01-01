import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { MongoClient, Db, Collection, Filter } from 'mongodb';
import { MetricsService } from '../metrics/metrics.service';
import { AuditEvent, AuditStats, AuditStatus } from './dto/audit-event.dto';
import { QueryAuditDto } from './dto/query-audit.dto';

/**
 * Audit Service - MongoDB-based activity logging
 *
 * Features:
 * - Automatic API request logging via interceptor
 * - TTL-based cleanup (7 days)
 * - Query API with filters
 * - Fire-and-forget logging (never blocks requests)
 *
 * Follows DatabaseService patterns:
 * - onModuleInit with 3-retry logic
 * - Graceful degradation when disabled
 * - Metrics instrumentation
 */
@Injectable()
export class AuditService implements OnModuleInit, OnModuleDestroy {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private collection: Collection<AuditEvent> | null = null;
  private isConnected = false;

  // TTL in seconds (7 days)
  private readonly TTL_SECONDS = 7 * 24 * 60 * 60;

  constructor(
    @InjectPinoLogger(AuditService.name)
    private readonly logger: PinoLogger,
    private readonly metrics: MetricsService,
  ) {}

  /**
   * Check if MongoDB is configured
   */
  get enabled(): boolean {
    return !!process.env.MONGODB_URL;
  }

  async onModuleInit() {
    if (!this.enabled) {
      this.logger.info('MONGODB_URL not set, audit features disabled');
      return;
    }

    try {
      this.client = new MongoClient(process.env.MONGODB_URL!, {
        maxPoolSize: 5,
        serverSelectionTimeoutMS: 5000,
      });

      // Track connection state changes
      this.client.on('close', () => {
        this.logger.warn('MongoDB connection closed');
        this.isConnected = false;
      });
      this.client.on('error', (error) => {
        this.logger.error({ error: error.message }, 'MongoDB connection error');
        this.isConnected = false;
      });
      this.client.on('reconnect', () => {
        this.logger.info('MongoDB reconnected');
        this.isConnected = true;
      });

      await this.waitForMongo();
      await this.setupCollection();

      this.isConnected = true;
      this.logger.info('Audit service initialized');
    } catch (error) {
      this.logger.error({ error }, 'Failed to initialize audit service');
      throw error;
    }
  }

  /**
   * Wait for MongoDB with short retry logic.
   * Follows the same pattern as DatabaseService.
   */
  private async waitForMongo(maxRetries = 3, delayMs = 1000): Promise<void> {
    if (!this.client) return;

    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.client.connect();
        await this.client.db().admin().ping();
        if (attempt > 1) {
          this.logger.info({ attempt }, 'MongoDB connection established');
        }
        return;
      } catch (error) {
        lastError = error as Error;
        if (attempt < maxRetries) {
          this.logger.warn(
            { attempt, maxRetries, error: lastError.message },
            'MongoDB not ready, retrying...',
          );
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }

    throw new Error(
      `MongoDB not available after ${maxRetries} attempts: ${lastError?.message}`,
    );
  }

  /**
   * Setup collection with TTL index for automatic cleanup
   */
  private async setupCollection(): Promise<void> {
    if (!this.client) return;

    // Use MONGODB_DATABASE env var or default to 'app'
    // Note: Connection string uses /admin for auth, but we store data in 'app' database
    const dbName = process.env.MONGODB_DATABASE || 'app';
    this.db = this.client.db(dbName);
    this.collection = this.db.collection<AuditEvent>('audit_events');

    // Create TTL index for automatic cleanup (7 days)
    try {
      await this.collection.createIndex(
        { timestamp: 1 },
        { expireAfterSeconds: this.TTL_SECONDS },
      );
    } catch {
      // Index may already exist with same settings
    }

    // Create compound indexes for common queries
    try {
      await this.collection.createIndex({ type: 1, timestamp: -1 });
      await this.collection.createIndex({ path: 1, timestamp: -1 });
      await this.collection.createIndex({ statusCode: 1, timestamp: -1 });
    } catch {
      // Indexes may already exist
    }

    this.logger.info('Audit collection setup complete with TTL index');
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.close();
      this.logger.info('MongoDB connection closed');
    }
  }

  /**
   * Log an audit event (fire-and-forget)
   * Never throws - audit should never break application flow
   */
  async logEvent(event: AuditEvent): Promise<void> {
    if (!this.enabled || !this.isConnected || !this.collection) {
      return;
    }

    const endTimer = this.metrics.mongoOperationDuration.startTimer({
      operation: 'insert',
    });
    let success = true;

    try {
      await this.collection.insertOne(event);
      this.metrics.auditEventsTotal.inc({ type: event.type });
    } catch (error) {
      success = false;
      // Log but don't throw - audit should never block requests
      this.logger.error({ error, event }, 'Failed to log audit event');
    } finally {
      endTimer({ success: String(success) });
    }
  }

  /**
   * Build MongoDB query filter from DTO
   */
  private buildQueryFilter(filters: QueryAuditDto): Filter<AuditEvent> {
    const query: Filter<AuditEvent> = {};

    if (filters.type) {
      query.type = filters.type;
    }

    if (filters.from || filters.to) {
      query.timestamp = {};
      if (filters.from) {
        query.timestamp.$gte = new Date(filters.from);
      }
      if (filters.to) {
        query.timestamp.$lte = new Date(filters.to);
      }
    }

    if (filters.pathPattern) {
      // Escape regex special characters and convert * to .*
      const pattern = filters.pathPattern
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\\\*/g, '.*');
      query.path = { $regex: new RegExp(pattern, 'i') };
    }

    if (filters.statusCode) {
      query.statusCode = filters.statusCode;
    }

    return query;
  }

  /**
   * Query audit events with filters
   */
  async queryEvents(filters: QueryAuditDto): Promise<AuditEvent[]> {
    if (!this.enabled || !this.isConnected || !this.collection) {
      return [];
    }

    const endTimer = this.metrics.mongoOperationDuration.startTimer({
      operation: 'query',
    });
    let success = true;

    try {
      const query = this.buildQueryFilter(filters);

      const events = await this.collection
        .find(query)
        .sort({ timestamp: -1 })
        .skip(filters.offset || 0)
        .limit(filters.limit || 50)
        .toArray();

      return events;
    } catch (error) {
      success = false;
      this.logger.error({ error, filters }, 'Failed to query audit events');
      throw error;
    } finally {
      endTimer({ success: String(success) });
    }
  }

  /**
   * Count audit events matching filters (for pagination)
   */
  async countEvents(filters: QueryAuditDto): Promise<number> {
    if (!this.enabled || !this.isConnected || !this.collection) {
      return 0;
    }

    try {
      const query = this.buildQueryFilter(filters);
      return await this.collection.countDocuments(query);
    } catch (error) {
      this.logger.error({ error, filters }, 'Failed to count audit events');
      return 0;
    }
  }

  /**
   * Get audit statistics
   */
  async getStats(): Promise<AuditStats> {
    if (!this.enabled || !this.isConnected || !this.collection) {
      return {
        totalEvents: 0,
        eventsByType: {
          api_request: 0,
          db_operation: 0,
          file_operation: 0,
          cache_operation: 0,
        },
      };
    }

    const endTimer = this.metrics.mongoOperationDuration.startTimer({
      operation: 'stats',
    });
    let success = true;

    try {
      // Get counts by type
      const pipeline = [
        { $group: { _id: '$type', count: { $sum: 1 } } },
      ];
      const typeCounts = await this.collection.aggregate(pipeline).toArray();

      const eventsByType = {
        api_request: 0,
        db_operation: 0,
        file_operation: 0,
        cache_operation: 0,
      };

      typeCounts.forEach((tc) => {
        if (tc._id in eventsByType) {
          eventsByType[tc._id as keyof typeof eventsByType] = tc.count;
        }
      });

      const totalEvents = Object.values(eventsByType).reduce((a, b) => a + b, 0);

      // Get oldest/newest events and collection stats in parallel
      const [oldest, newest, stats] = await Promise.all([
        this.collection.find().sort({ timestamp: 1 }).limit(1).toArray(),
        this.collection.find().sort({ timestamp: -1 }).limit(1).toArray(),
        this.db?.command({ collStats: 'audit_events' }).catch(() => null) ?? null,
      ]);

      return {
        totalEvents,
        eventsByType,
        oldestEvent: oldest[0]?.timestamp,
        newestEvent: newest[0]?.timestamp,
        storageBytes: stats?.storageSize,
      };
    } catch (error) {
      success = false;
      this.logger.error({ error }, 'Failed to get audit stats');
      throw error;
    } finally {
      endTimer({ success: String(success) });
    }
  }

  /**
   * Get service status for health checks
   */
  async getStatus(): Promise<AuditStatus> {
    if (!this.enabled) {
      return { enabled: false, connected: false };
    }

    return {
      enabled: true,
      connected: this.isConnected,
      database: this.db?.databaseName,
      collection: 'audit_events',
      ttlDays: 7,
    };
  }
}
