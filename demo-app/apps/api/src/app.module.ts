import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseService } from './database.service';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      // __dirname at runtime is /app/apps/api/dist, so public is a sibling
      rootPath: join(__dirname, 'public'),
      // path-to-regexp v8 requires named parameters
      exclude: ['/api{/*path}'],
    }),
  ],
  controllers: [AppController],
  providers: [AppService, DatabaseService],
})
export class AppModule {}
