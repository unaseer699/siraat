import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PublicProjectsService } from './public-projects.service';

// 08:00 every day, Pakistan time. Set DISABLE_SCHEDULER=true on any instance
// that must not run it (a second server, a test run).
@Injectable()
export class PublicProjectsScheduler {
  private readonly logger = new Logger(PublicProjectsScheduler.name);

  constructor(private readonly svc: PublicProjectsService) {}

  @Cron('0 8 * * *', { name: 'public-projects-news', timeZone: 'Asia/Karachi' })
  async daily(): Promise<void> {
    if (process.env.DISABLE_SCHEDULER === 'true') return;
    try {
      await this.svc.refreshNews();
    } catch (err) {
      this.logger.error(`Daily refresh failed: ${err instanceof Error ? err.message : err}`);
    }
  }
}
