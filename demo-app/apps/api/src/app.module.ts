import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { LoggerModule } from 'nestjs-pino';
import { Request } from 'express';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseService } from './database.service';
import { MetricsModule } from './metrics/metrics.module';
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
  ],
  controllers: [AppController],
  providers: [AppService, DatabaseService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
    consumer.apply(MetricsMiddleware).forRoutes('*');
  }
}
