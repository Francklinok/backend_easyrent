
import { IUser, LoginHistory } from "../userTypes/userTypes"; // à adapter à ton arborescence


export function recordLoginAttempt(this: IUser, data: Omit<LoginHistory, 'timestamp'>): void {
  this.loginHistory.push({
    timestamp: new Date(),
    ...data
  });

  if (this.loginHistory.length > 50) {
    this.loginHistory = this.loginHistory.slice(-50); // Conserver les 50 dernières
  }
}
