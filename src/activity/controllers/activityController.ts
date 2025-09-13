import { Request, Response, NextFunction } from 'express';
import ActivityServices from '../service/ActivityServices';
import { createLogger } from '../../utils/logger/logger';
import { Server as IOServer } from 'socket.io';
import  { Type } from '@sinclair/typebox';

const logger = createLogger('ActivityController');

class ActivityController {
  private activityService: ActivityServices;

  constructor(io: IOServer) {
    this.activityService = new ActivityServices(io);
  }

  async createVisite(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { propertyId, visitDate, message } = req.body;
      const clientId = req.user?.userId;

      if (!clientId) {
        res.status(401).json({ success: false, message: 'Utilisateur non authentifié' });
        return;
      }

      const result = await this.activityService.createVisite({
        propertyId,
        visitDate,
        message,
        clientId as  Type.ObjectId
      });

      res.status(201).json({
        success: true,
        message: 'Visite créée avec succès',
        data: result
      });
    } catch (error) {
      logger.error('Erreur lors de la création de visite', { error });
      next(error);
    }
  }

  async createReservation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { activityId, reservationDate, uploadedFiles } = req.body;

      const result = await this.activityService.createReservation({
        activityId,
        reservationDate,
        uploadedFiles
      });

      res.status(201).json({
        success: true,
        message: 'Réservation créée avec succès',
        data: result
      });
    } catch (error) {
      logger.error('Erreur lors de la création de réservation', { error });
      next(error);
    }
  }

  async acceptReservation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { activityId } = req.body;

      const result = await this.activityService.acceptReservation({ activityId });

      res.status(200).json({
        success: true,
        message: 'Réservation acceptée avec succès',
        data: result
      });
    } catch (error) {
      logger.error('Erreur lors de l\'acceptation de réservation', { error });
      next(error);
    }
  }

  async refuseReservation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { activityId, reason } = req.body;

      const result = await this.activityService.refuseReservation({ activityId, reason });

      res.status(200).json({
        success: true,
        message: 'Réservation refusée',
        data: result
      });
    } catch (error) {
      logger.error('Erreur lors du refus de réservation', { error });
      next(error);
    }
  }

  async processPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { activityId, amount } = req.body;

      const result = await this.activityService.processPayment(activityId, { amount });

      res.status(200).json({
        success: true,
        message: 'Paiement traité avec succès',
        data: result
      });
    } catch (error) {
      logger.error('Erreur lors du traitement du paiement', { error });
      next(error);
    }
  }

  async acceptVisit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { activityId } = req.body;

      const result = await this.activityService.acceptVisitRequest(activityId);

      res.status(200).json({
        success: true,
        message: 'Visite acceptée',
        data: result
      });
    } catch (error) {
      logger.error('Erreur lors de l\'acceptation de visite', { error });
      next(error);
    }
  }

  async refuseVisit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { activityId } = req.body;

      const result = await this.activityService.refuseVisitRequest(activityId);

      res.status(200).json({
        success: true,
        message: 'Visite refusée',
        data: result
      });
    } catch (error) {
      logger.error('Erreur lors du refus de visite', { error });
      next(error);
    }
  }

  async getOwnerActivities(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ownerId = req.user?.userId;
      const { page = 1, limit = 10 } = req.query;

      if (!ownerId) {
        res.status(401).json({ success: false, message: 'Utilisateur non authentifié' });
        return;
      }

      const result = await this.activityService.getOwnerActivities(ownerId, {
        page: Number(page),
        limit: Number(limit)
      });

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Erreur lors de la récupération des activités propriétaire', { error });
      next(error);
    }
  }

  async getActivities(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { page = 1, limit = 10 } = req.query;

      if (!userId) {
        res.status(401).json({ success: false, message: 'Utilisateur non authentifié' });
        return;
      }

      const result = await this.activityService.getUserActivities(userId, {
        page: Number(page),
        limit: Number(limit)
      });

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Erreur lors de la récupération des activités', { error });
      next(error);
    }
  }

  async getActivityById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const result = await this.activityService.getActivityById(id);

      if (!result) {
        res.status(404).json({
          success: false,
          message: 'Activité non trouvée'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Erreur lors de la récupération de l\'activité', { error });
      next(error);
    }
  }
}

export default ActivityController;