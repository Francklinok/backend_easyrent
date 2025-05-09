import { IUser } from "../userTypes/userTypes";// à adapter à ton arborescence

export function updateLastLogin(this: IUser, ipAddress: string, userAgent: string): void {
  this.lastLogin = new Date();
  this.recordLoginAttempt({
    ipAddress,
    userAgent,
    successful: true
  });
}