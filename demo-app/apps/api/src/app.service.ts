import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  private readonly startTime = Date.now();

  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
    };
  }

  getInfo() {
    return {
      pr: process.env.PR_NUMBER || 'unknown',
      commit: process.env.COMMIT_SHA || 'unknown',
      branch: process.env.BRANCH_NAME || 'unknown',
      version: process.env.APP_VERSION || '1.0.0',
      previewUrl: process.env.PREVIEW_URL || 'unknown',
    };
  }
}
