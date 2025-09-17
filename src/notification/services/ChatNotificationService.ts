import { NotificationManager } from './NotificationManager';
import { createLogger } from '../../utils/logger/logger';

const logger = createLogger('ChatNotificationService');

/**
 * Service de notifications pour le chat
 * Gère toutes les notifications liées aux messages et conversations
 */
export class ChatNotificationService {
  constructor(private notificationManager: NotificationManager) {}

  /**
   * Notification pour nouveau message
   */
  async sendNewMessageNotification(message: any, conversation: any): Promise<boolean> {
    try {
      const participants = conversation.participants.filter(
        (p: any) => p._id?.toString() !== message.senderId?.toString()
      );

      if (participants.length === 0) {
        return true; // Pas de participants à notifier
      }

      // Obtenir les informations de l'expéditeur
      const senderName = await this.getSenderName(message.senderId);

      // Préparer le contenu du message
      let messagePreview = '';
      if (typeof message.content === 'string') {
        messagePreview = message.content.length > 100
          ? message.content.substring(0, 100) + '...'
          : message.content;
      } else {
        messagePreview = this.getMessageTypeDescription(message.messageType);
      }

      const targetUserIds = participants.map((p: any) => p._id?.toString() || p.toString());

      return await this.notificationManager.sendNotification({
        type: 'push',
        title: `💬 ${senderName}`,
        body: messagePreview,
        data: {
          type: 'chat',
          action: 'new_message',
          conversationId: conversation._id.toString(),
          messageId: message._id?.toString(),
          senderId: message.senderId?.toString(),
          messageType: message.messageType
        },
        targetUsers: targetUserIds,
        priority: this.getMessagePriority(message),
        sound: 'default',
        badge: true
      });
    } catch (error) {
      logger.error('Erreur notification nouveau message', {
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        messageId: message._id,
        conversationId: conversation._id
      });
      return false;
    }
  }

  /**
   * Notification pour réaction à un message
   */
  async sendMessageReactionNotification(
    message: any,
    reactorId: string,
    reactionType: string,
    conversation: any
  ): Promise<boolean> {
    try {
      // Ne notifier que l'auteur du message original
      if (message.senderId?.toString() === reactorId) {
        return true; // Pas besoin de se notifier soi-même
      }

      const reactorName = await this.getSenderName(reactorId);

      return await this.notificationManager.sendNotification({
        type: 'push',
        title: '👍 Nouvelle réaction',
        body: `${reactorName} a réagi ${reactionType} à votre message`,
        data: {
          type: 'chat',
          action: 'message_reaction',
          conversationId: conversation._id.toString(),
          messageId: message._id?.toString(),
          reactorId,
          reactionType
        },
        targetUsers: [message.senderId?.toString()],
        priority: 'normal',
        sound: 'subtle',
        badge: false
      });
    } catch (error) {
      logger.error('Erreur notification réaction message', {
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        messageId: message._id,
        reactorId
      });
      return false;
    }
  }

  /**
   * Notification pour mention dans un message
   */
  async sendMessageMentionNotification(
    message: any,
    mentionedUserIds: string[],
    conversation: any
  ): Promise<boolean> {
    try {
      if (mentionedUserIds.length === 0) {
        return true;
      }

      const senderName = await this.getSenderName(message.senderId);

      return await this.notificationManager.sendNotification({
        type: 'push',
        title: `🔔 ${senderName} vous a mentionné`,
        body: typeof message.content === 'string'
          ? message.content.substring(0, 100)
          : 'Message avec mention',
        data: {
          type: 'chat',
          action: 'message_mention',
          conversationId: conversation._id.toString(),
          messageId: message._id?.toString(),
          senderId: message.senderId?.toString()
        },
        targetUsers: mentionedUserIds,
        priority: 'high',
        sound: 'attention',
        badge: true
      });
    } catch (error) {
      logger.error('Erreur notification mention message', {
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        messageId: message._id,
        mentionedUserIds
      });
      return false;
    }
  }

  /**
   * Notification pour nouvelle conversation créée
   */
  async sendConversationCreatedNotification(conversation: any, creatorId: string): Promise<boolean> {
    try {
      const participants = conversation.participants.filter(
        (p: any) => p._id?.toString() !== creatorId
      );

      if (participants.length === 0) {
        return true;
      }

      const creatorName = await this.getSenderName(creatorId);

      let title = '';
      let body = '';

      if (conversation.type === 'direct') {
        title = `💬 ${creatorName}`;
        body = 'A commencé une conversation avec vous';
      } else if (conversation.type === 'group') {
        title = '👥 Nouvelle conversation de groupe';
        body = `${creatorName} vous a ajouté à un groupe`;
      } else if (conversation.type === 'property_discussion') {
        title = '🏠 Discussion propriété';
        body = `${creatorName} souhaite discuter d'une propriété`;
      }

      const targetUserIds = participants.map((p: any) => p._id?.toString() || p.toString());

      return await this.notificationManager.sendNotification({
        type: 'push',
        title,
        body,
        data: {
          type: 'chat',
          action: 'conversation_created',
          conversationId: conversation._id.toString(),
          creatorId,
          conversationType: conversation.type,
          propertyId: conversation.propertyId?.toString()
        },
        targetUsers: targetUserIds,
        priority: 'normal',
        sound: 'default',
        badge: true
      });
    } catch (error) {
      logger.error('Erreur notification nouvelle conversation', {
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        conversationId: conversation._id,
        creatorId
      });
      return false;
    }
  }

  /**
   * Notification pour message programmé livré
   */
  async sendScheduledMessageDeliveredNotification(message: any): Promise<boolean> {
    try {
      return await this.notificationManager.sendNotification({
        type: 'push',
        title: '⏰ Message programmé envoyé',
        body: 'Votre message programmé a été livré',
        data: {
          type: 'chat',
          action: 'scheduled_message_delivered',
          messageId: message._id?.toString()
        },
        targetUsers: [message.senderId?.toString()],
        priority: 'low',
        sound: 'subtle',
        badge: false
      });
    } catch (error) {
      logger.error('Erreur notification message programmé', {
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        messageId: message._id
      });
      return false;
    }
  }

  // ==================== MÉTHODES UTILITAIRES ====================

  /**
   * Obtenir le nom de l'expéditeur
   */
  private async getSenderName(senderId: any): Promise<string> {
    try {
      // Ici vous pourriez faire un appel à la base de données pour obtenir le nom
      // Pour l'instant, on retourne un nom générique
      return 'Utilisateur';
    } catch (error) {
      logger.error('Erreur récupération nom expéditeur', { senderId, error });
      return 'Utilisateur';
    }
  }

  /**
   * Obtenir la description du type de message
   */
  private getMessageTypeDescription(messageType: string): string {
    const descriptions: Record<string, string> = {
      'text': 'Message texte',
      'image': '📷 Photo partagée',
      'video': '🎥 Vidéo partagée',
      'audio': '🎵 Audio partagé',
      'document': '📄 Document partagé',
      'location': '📍 Position partagée',
      'contact': '👤 Contact partagé',
      'property': '🏠 Propriété partagée',
      'voice_note': '🎤 Note vocale',
      'ar_preview': '🔮 Aperçu AR',
      'virtual_tour': '🏠 Visite virtuelle'
    };

    return descriptions[messageType] || 'Message';
  }

  /**
   * Déterminer la priorité du message
   */
  private getMessagePriority(message: any): 'low' | 'normal' | 'high' | 'urgent' {
    // Messages avec mentions = priorité élevée
    if (message.mentions && message.mentions.length > 0) {
      return 'high';
    }

    // Messages de réponse = priorité normale élevée
    if (message.replyTo) {
      return 'normal';
    }

    // Messages avec IA détectant une urgence
    if (message.aiInsights?.priority === 'urgent') {
      return 'urgent';
    }

    if (message.aiInsights?.priority === 'high') {
      return 'high';
    }

    // Messages liés aux propriétés = priorité normale
    if (message.messageType === 'property' || message.messageType === 'location') {
      return 'normal';
    }

    // Médias = priorité légèrement plus faible
    if (['image', 'video', 'audio', 'document'].includes(message.messageType)) {
      return 'normal';
    }

    return 'normal';
  }

  /**
   * Vérifier si l'utilisateur accepte ce type de notification
   */
  private async shouldNotifyUser(userId: string, notificationType: string): Promise<boolean> {
    try {
      // Ici vous pourriez vérifier les préférences utilisateur
      // Pour l'instant, on accepte toutes les notifications
      return true;
    } catch (error) {
      logger.error('Erreur vérification préférences utilisateur', { userId, notificationType, error });
      return true; // Par défaut, on notifie
    }
  }

  /**
   * Formater le message pour différents types de notifications
   */
  private formatMessageForNotification(message: any, maxLength: number = 100): string {
    if (!message.content) {
      return this.getMessageTypeDescription(message.messageType);
    }

    if (typeof message.content === 'string') {
      return message.content.length > maxLength
        ? message.content.substring(0, maxLength) + '...'
        : message.content;
    }

    return this.getMessageTypeDescription(message.messageType);
  }

  /**
   * Obtenir le statut du service
   */
  async getServiceStatus(): Promise<{
    isHealthy: boolean;
    lastActivity: Date;
    notificationsSent: number;
  }> {
    return {
      isHealthy: true,
      lastActivity: new Date(),
      notificationsSent: 0 // À implémenter avec des métriques réelles
    };
  }
}