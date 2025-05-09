
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { IUser } from '../userTypes/userTypes'; // à adapter à ton arborescence

export async function generatePasswordResetToken(this: IUser): Promise<string> {
  const token = uuidv4();
  this.passwordResetToken = token;
  this.passwordResetExpires = new Date(Date.now() + 3600000); // 1h
  await this.save();
  return token;
}
