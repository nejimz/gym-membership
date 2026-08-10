import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.config.get('SMTP_HOST', 'localhost'),
      port: Number(this.config.get('SMTP_PORT', 1025)),
      secure: false,
      tls: { rejectUnauthorized: false },
    });
  }

  async send(to: string, subject: string, text: string) {
    const from = this.config.get('SMTP_FROM', 'noreply@gym.local');
    try {
      await this.transporter.sendMail({ from, to, subject, text });
      return true;
    } catch (err) {
      this.logger.warn(`Email failed to ${to}: ${String(err)}`);
      return false;
    }
  }
}
