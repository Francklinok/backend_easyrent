import  config from "../../../config"

class ValidationService {
  static validateMessageInput(params: {
    conversationId: string;
    content: string;
    messageType: string;
    userId: string;
  }): void {
    const { conversationId, content, messageType, userId } = params;

    if (!conversationId?.trim()) {
      throw new Error('ID de conversation requis');
    }

    if (!content?.trim()) {
      throw new Error('Contenu du message requis');
    }

    if (content.length > config.messageMaxLength) {
      throw new Error(`Message trop long (maximum ${config.messageMaxLength} caractères)`);
    }

    const validMessageTypes = ['text', 'image', 'video', 'audio', 'file', 'voice'];
    if (!validMessageTypes.includes(messageType)) {
      throw new Error(`Type de message invalide. Types autorisés: ${validMessageTypes.join(', ')}`);
    }

    if (!userId?.trim()) {
      throw new Error('ID utilisateur requis');
    }
  }

  static validatePagination(page: number, limit: number): { page: number; limit: number } {
    const validatedPage = Math.max(1, Math.floor(page) || 1);
    const validatedLimit = Math.min(config.pagination.maxLimit, Math.max(1, Math.floor(limit) || config.pagination.defaultLimit));
    
    return { page: validatedPage, limit: validatedLimit };
  }
}


export  default ValidationService