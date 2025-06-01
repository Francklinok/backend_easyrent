import bcrypt from 'bcrypt';
import { createLogger } from '../../utils/logger/logger';

const logger = createLogger('PasswordUtils');

export class PasswordUtils {
  /**
   * Compare un mot de passe avec son hash
   * @param candidatePassword - Mot de passe en clair
   * @param hashedPassword - Hash du mot de passe
   * @returns Promise<boolean>
   */
  static async comparePassword(
    candidatePassword: string, 
    hashedPassword: string
  ): Promise<boolean> {
    try {
      
        console.log('le mot de  pass en realiter  dans  la base de donner  est :',  candidatePassword)
        console.log('voicie  le mot de  passse  hasher  :',hashedPassword)
      // Validation des entrées

      if (!candidatePassword || typeof candidatePassword !== 'string') {
        logger.warn('Mot de passe candidat invalide ou manquant');
        return false;
      }

      if (!hashedPassword || typeof hashedPassword !== 'string') {
        logger.warn('Hash de mot de passe invalide ou manquant');
        return false;
      }
        const test = await bcrypt.compare('MotDePasse123!', '$2b$12$tA90TrjJ4Ympkp5B20y9jeiZDNxY1arR0N/pw5nuRgcredXLIFdQG')


        console.log('my compare password  test is  :',test); // Résultat attendu: true

      // Vérification du format du hash bcrypt
      if (!hashedPassword.startsWith('$2b$') && !hashedPassword.startsWith('$2a$')) {
        logger.error('Format de hash bcrypt invalide');
        return false;
      }

      logger.debug('Comparaison mot de passe', {
        candidateLength: candidatePassword.length,
        hashLength: hashedPassword.length,
        hashPrefix: hashedPassword.substring(0, 7)
      });
      
      this.runAllTests()
    //   const isMatch = bcrypt.compareSync(candidatePassword, hashedPassword);

      const isMatch = await bcrypt.compare(candidatePassword, hashedPassword);
      console.log('user  password comparison',isMatch)
      logger.info('Résultat comparaison mot de passe', { 
        success: isMatch,
        candidateLength: candidatePassword.length 
      });

      return isMatch;
    } catch (error) {
      logger.error('Erreur lors de la comparaison des mots de passe', {
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        stack: error instanceof Error ? error.stack : undefined
      });
      return false;
    }
  }

  /**
   * Hash un mot de passe
   * @param password - Mot de passe en clair
   * @param saltRounds - Nombre de rounds de salt (défaut: 12)
   * @returns Promise<string>
   */
  static async hashPassword(password: string): Promise<string> {
    try {
      if (!password || typeof password !== 'string') {
        throw new Error('Mot de passe invalide');
      }
      
      const  salt = await  bcrypt.genSalt(12)
      return  await bcrypt.hash(password, salt);
        } catch (error) {
      logger.error('Erreur lors du hashage du mot de passe', { error });
      throw new Error('Impossible de hasher le mot de passe');
    }
  }
  
  
  static async testExactPassword(){
    const plainPassword = 'MotDePasse123!';
    // const storedHash = '$2b$12$aISRVVQBjLp348XzmKZmNeVlkVDz7YSx6QsPfJ8qQgmJTyIdOx3CO'
    const  storedHash = '$2b$12$tA90TrjJ4Ympkp5B20y9jeiZDNxY1arR0N/pw5nuRgcredXLIFdQG'
;
    
    console.log('=== TEST BCRYPT ===');
    console.log('Mot de passe:', plainPassword);
    console.log('Hash stocké:', storedHash);
    console.log('Longueur mot de passe:', plainPassword.length);
    console.log('Longueur hash:', storedHash.length);
    
    // Test avec différentes méthodes
    try {
      // Méthode 1: bcrypt standard
      console.log('\n--- Test bcrypt.compare ---');
      const result1 = await bcrypt.compare(plainPassword, storedHash);
      console.log('Résultat bcrypt.compare:', result1);
      
      // Méthode 2: Créer un nouveau hash et comparer
      console.log('\n--- Test nouveau hash ---');
      const newHash = await bcrypt.hash(plainPassword, 12);
      console.log('Nouveau hash:', newHash);
      const result2 = await bcrypt.compare(plainPassword, newHash);
      console.log('Résultat avec nouveau hash:', result2);
      
      // Méthode 3: Test caractère par caractère
      console.log('\n--- Analyse caractère par caractère ---');
      console.log('Premiers caractères du mot de passe:');
      for (let i = 0; i < Math.min(plainPassword.length, 10); i++) {
        console.log(`  [${i}]: "${plainPassword[i]}" (code: ${plainPassword.charCodeAt(i)})`);
      }
      
      // Méthode 4: Test avec trim
      console.log('\n--- Test avec trim ---');
      const trimmedPassword = plainPassword.trim();
      console.log('Mot de passe trimé:', `"${trimmedPassword}"`);
      const result3 = await bcrypt.compare(trimmedPassword, storedHash);
      console.log('Résultat avec trim:', result3);
      
      // Méthode 5: Test encodage
      console.log('\n--- Test encodage ---');
      const buffer = Buffer.from(plainPassword, 'utf8');
      const passwordFromBuffer = buffer.toString('utf8');
      console.log('Password depuis buffer:', passwordFromBuffer);
      const result4 = await bcrypt.compare(passwordFromBuffer, storedHash);
      console.log('Résultat depuis buffer:', result4);
      
    } catch (error) {
      console.error('Erreur lors du test:', error);
    }
  };
  
  // Test avec différents mots de passe pour vérifier
  static async testMultiplePasswords () {
    const storedHash = '$2b$12$tA90TrjJ4Ympkp5B20y9jeiZDNxY1arR0N/pw5nuRgcredXLIFdQG'

    const testPasswords = [
      'MotDePasse123!',
      'motdepasse123!',
      'MotDePasse123',
      'MotDePasse123! ',
      ' MotDePasse123!',
    ];
    
    console.log('\n=== TEST MULTIPLES MOTS DE PASSE ===');
    for (const pwd of testPasswords) {
      try {
        const result = await bcrypt.compare(pwd, storedHash);
        console.log(`"${pwd}" (longueur: ${pwd.length}) -> ${result}`);
      } catch (error:any) {
        console.log(`"${pwd}" -> ERREUR: ${error.message}`);
      }
    }
  };
  
  // Exécution des tests
  static async runAllTests () {
    await this.testExactPassword();
    await this.testMultiplePasswords();
  };
  
  
  
}

