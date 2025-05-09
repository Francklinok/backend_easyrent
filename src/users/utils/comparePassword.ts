import bcrypt from 'bcrypt';
import { IUser } from '../userTypes/userTypes';// à adapter à ton arborescence

export async function comparePassword(this: IUser, candidatePassword: string): Promise<boolean> {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('Erreur lors de la comparaison des mots de passe');
  }
} 