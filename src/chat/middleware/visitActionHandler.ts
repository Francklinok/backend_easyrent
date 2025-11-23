import { Types } from 'mongoose';
import Message from '../model/chatModel';
// Import dynamique pour éviter la dépendance circulaire
import ActivityNotificationService from '../../activity/service/ActivityNotificationService';
import { createLogger } from '../../utils/logger/logger';

const logger = createLogger('VisitActionHandler');

export class VisitActionHandler {
  private activityNotificationService: ActivityNotificationService;

  constructor() {
    this.activityNotificationService = new ActivityNotificationService(null as any);
  }

  async handleVisitAction(
    content: string,
    userId: string,
    conversationId: string
  ): Promise<{ handled: boolean; response?: string }> {
    const normalizedContent = content.trim().toUpperCase();
    
    if (!['ACCEPTER', 'REFUSER', 'ACCEPT', 'REFUSE'].includes(normalizedContent)) {
      return { handled: false };
    }

    try {
      // Trouver le dernier message de demande de visite dans cette conversation
      const visitRequestMessage = await Message.findOne({
        conversationId: new Types.ObjectId(conversationId),
        messageType: 'visit_request',
        'metadata.activityId': { $exists: true }
      }).sort({ createdAt: -1 });

      if (!visitRequestMessage || !visitRequestMessage.metadata?.activityId) {
        return {
          handled: true,
          response: "❌ Aucune demande de visite récente trouvée dans cette conversation."
        };
      }

      const activityId = visitRequestMessage.metadata.activityId;
      const isAccept = ['ACCEPTER', 'ACCEPT'].includes(normalizedContent);

      // Importer dynamiquement ActivityServices pour éviter la dépendance circulaire
      const ActivityServices = (await import('../../activity/service/ActivityServices')).default;
      const activityService = new ActivityServices(null as any);

      if (isAccept) {
        const result = await activityService.acceptVisitRequest(activityId);
        if (result) {
          await this.activityNotificationService.sendVisitResponseNotifications(result, true);
        }
        return {
          handled: true,
          response: "✅ **Visite acceptée !**\n\nLa demande de visite a été acceptée avec succès. Le demandeur a été notifié."
        };
      } else {
        const result = await activityService.refuseVisitRequest(activityId);
        if (result) {
          await this.activityNotificationService.sendVisitResponseNotifications(result, false);
        }
        return {
          handled: true,
          response: "❌ **Visite refusée**\n\nLa demande de visite a été refusée. Le demandeur a été notifié."
        };
      }

    } catch (error) {
      logger.error('Erreur lors du traitement de l\'action de visite:', error);
      return {
        handled: true,
        response: "⚠️ Une erreur s'est produite lors du traitement de votre demande. Veuillez réessayer."
      };
    }
  }
}

export default VisitActionHandler;