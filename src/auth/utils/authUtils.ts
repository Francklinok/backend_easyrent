import type { Request as ExpressRequest } from 'express';

class AuthUtils {
  static maskEmail(email: string): string {
    if (!email || email.length < 3) return '***';
    return email.substring(0, Math.min(5, email.indexOf('@'))) + '***';
  }

  static extractLoginDetails(req: ExpressRequest) {
    return {
      ipAddress: req.ip ?? req.socket?.remoteAddress ?? 'unknown',
      userAgent: req.get('user-agent') ?? 'unknown'
    } as { ipAddress: string; userAgent: string };
  }

  static createSecurityLog(eventType: string, req: ExpressRequest, userId?: string, email?: string) {
    return {
      eventType,
      userId,
      ipAddress: this.extractLoginDetails(req).ipAddress,
      userAgent: this.extractLoginDetails(req).userAgent,
      details: email ? { email: this.maskEmail(email) } : undefined
    };
  }
}

export default AuthUtils;
