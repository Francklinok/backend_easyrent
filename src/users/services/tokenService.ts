import mongoose from 'mongoose';
import { 
  IRefreshTokenDocument, 
  IRefreshTokenModel, 
  ICreateRefreshToken,
  IUpdateRefreshToken,
  IRefreshTokenQuery,
  IRefreshTokenPopulated 
} from './types/refreshToken.types';

// Déclaration du modèle avec les types
const RefreshToken: IRefreshTokenModel = mongoose.model<IRefreshTokenDocument, IRefreshTokenModel>('RefreshToken', RefreshTokenSchema);

// Service exemple utilisant les types
class RefreshTokenService {
  
  // Créer un nouveau refresh token
  async createRefreshToken(data: ICreateRefreshToken): Promise<IRefreshTokenDocument> {
    const refreshToken = new RefreshToken(data);
    return await refreshToken.save();
  }

  // Trouver un token par valeur
  async findByToken(token: string): Promise<IRefreshTokenDocument | null> {
    return await RefreshToken.findOne({ 
      token, 
      isActive: true,
      expiresAt: { $gt: new Date() }
    });
  }

  // Mettre à jour un token
  async updateToken(
    tokenId: string, 
    updates: IUpdateRefreshToken
  ): Promise<IRefreshTokenDocument | null> {
    return await RefreshToken.findByIdAndUpdate(
      tokenId, 
      updates, 
      { new: true }
    );
  }

  // Recherche avec query typée
  async findTokens(query: IRefreshTokenQuery): Promise<IRefreshTokenDocument[]> {
    return await RefreshToken.find(query);
  }

  // Obtenir les tokens d'un utilisateur avec populate
  async getUserTokensPopulated(userId: string): Promise<IRefreshTokenPopulated[]> {
    return await RefreshToken
      .find({ user: userId, isActive: true })
      .populate('user', 'email name')
      .lean() as IRefreshTokenPopulated[];
  }

  // Utiliser les méthodes d'instance
  async revokeToken(tokenId: string): Promise<boolean> {
    const token = await RefreshToken.findById(tokenId);
    if (!token) return false;

    if (token.isExpired()) {
      throw new Error('Token already expired');
    }

    await token.revoke();
    return true;
  }

  // Utiliser les méthodes statiques
  async revokeAllUserTokens(userId: string): Promise<void> {
    await RefreshToken.revokeAllForUser(userId);
  }

  async getActiveUserTokens(userId: string): Promise<IRefreshTokenDocument[]> {
    return await RefreshToken.findActiveByUser(userId);
  }

  // Nettoyage périodique
  async cleanupExpiredTokens(): Promise<void> {
    await RefreshToken.cleanupExpired();
  }
}

// Exemple d'utilisation dans un contrôleur
class AuthController {
  private refreshTokenService = new RefreshTokenService();

  async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;
      
      // Type safety: TypeScript sait que findByToken retourne IRefreshTokenDocument | null
      const tokenDoc = await this.refreshTokenService.findByToken(refreshToken);
      
      if (!tokenDoc) {
        res.status(401).json({ error: 'Invalid refresh token' });
        return;
      }

      // Utilisation des méthodes d'instance avec type safety
      if (tokenDoc.isExpired()) {
        res.status(401).json({ error: 'Token expired' });
        return;
      }

      // Mise à jour de la dernière utilisation
      await tokenDoc.updateLastUsed();

      // Génération d'un nouveau token...
      res.json({ 
        accessToken: 'new-access-token',
        user: tokenDoc.user 
      });

    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }

  async logout(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;
      const tokenDoc = await this.refreshTokenService.findByToken(refreshToken);
      
      if (tokenDoc) {
        await tokenDoc.revoke();
      }

      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
}


export { RefreshToken, RefreshTokenService, AuthController };