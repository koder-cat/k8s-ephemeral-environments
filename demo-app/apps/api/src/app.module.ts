import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { LoggerModule } from 'nestjs-pino';
import { Request } from 'express';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database.module';
import { MetricsModule } from './metrics/metrics.module';
import { SimulatorModule } from './simulator/simulator.module';
import { DatabaseTestModule } from './database-test/database-test.module';
import { AuditModule, AuditInterceptor } from './audit';
import { CacheModule } from './cache';
import { StorageModule } from './storage';
import { CorrelationIdMiddleware } from './middleware/correlation-id.middleware';
import { MetricsMiddleware } from './middleware/metrics.middleware';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      // __dirname at runtime is /app/apps/api/dist, so public is a sibling
      rootPath: join(__dirname, 'public'),
      // path-to-regexp v8 requires named parameters
      exclude: ['/api{/*path}', '/metrics'],
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL || 'info',
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true } }
            : undefined,
        // Use correlation ID from request (cast to Express Request for extended type)
        customProps: (req) => ({
          correlationId: (req as Request).correlationId,
        }),
        // Redact sensitive headers
        redact: ['req.headers.authorization', 'req.headers.cookie'],
        // Auto-log requests
        autoLogging: {
          ignore: (req) => req.url === '/metrics' || req.url === '/api/health',
        },
      },
    }),
    MetricsModule,
    DatabaseModule,
    AuditModule,
    CacheModule,
    StorageModule,
    SimulatorModule,
    DatabaseTestModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Register AuditInterceptor globally to log all API requests
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
    consumer.apply(MetricsMiddleware).forRoutes('*');
  }
}
