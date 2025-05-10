// 📨 Générer un token de vérification
import { v4 as uuidv4 } from 'uuid';
import { IUser } from '../types/userTypes'; // à adapter à ton arborescence

export function generateVerificationToken(this: IUser): string {
  const token = uuidv4();
  this.verificationToken = token;
  return token;
}