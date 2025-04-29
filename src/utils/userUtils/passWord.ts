import bcrypt from 'bcrypt';

export async function comparePassword(this: any, candidatePassword: string): Promise<boolean> {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('Erreur lors de la comparaison des mots de passe');
  }
} 