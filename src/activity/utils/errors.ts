/**
 * Classes d'erreurs personnalisées pour le module Activity
 */

export class ActivityError extends Error {
  public statusCode: number;
  public code: string;
  public details?: any;

  constructor(message: string, statusCode: number = 500, code?: string, details?: any) {
    super(message);
    this.name = 'ActivityError';
    this.statusCode = statusCode;
    this.code = code || 'ACTIVITY_ERROR';
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ActivityNotFoundError extends ActivityError {
  constructor(activityId: string) {
    super(`Activity with ID ${activityId} not found`, 404, 'ACTIVITY_NOT_FOUND', { activityId });
    this.name = 'ActivityNotFoundError';
  }
}

export class PropertyNotFoundError extends ActivityError {
  constructor(propertyId: string) {
    super(`Property with ID ${propertyId} not found`, 404, 'PROPERTY_NOT_FOUND', { propertyId });
    this.name = 'PropertyNotFoundError';
  }
}

export class PropertyNotAvailableError extends ActivityError {
  constructor(propertyId: string, currentStatus: string) {
    super(
      `Property with ID ${propertyId} is not available. Current status: ${currentStatus}`,
      400,
      'PROPERTY_NOT_AVAILABLE',
      { propertyId, currentStatus }
    );
    this.name = 'PropertyNotAvailableError';
  }
}

export class UserNotFoundError extends ActivityError {
  constructor(userId: string) {
    super(`User with ID ${userId} not found`, 404, 'USER_NOT_FOUND', { userId });
    this.name = 'UserNotFoundError';
  }
}

export class InvalidPaymentAmountError extends ActivityError {
  constructor(expectedAmount: number, providedAmount: number) {
    super(
      `Invalid payment amount. Expected: ${expectedAmount}, Provided: ${providedAmount}`,
      400,
      'INVALID_PAYMENT_AMOUNT',
      { expectedAmount, providedAmount }
    );
    this.name = 'InvalidPaymentAmountError';
  }
}

export class DocumentsRequiredError extends ActivityError {
  constructor() {
    super(
      'Documents are required for this property reservation',
      400,
      'DOCUMENTS_REQUIRED'
    );
    this.name = 'DocumentsRequiredError';
  }
}

export class ReservationAlreadyProcessedError extends ActivityError {
  constructor(activityId: string, currentStatus: string) {
    super(
      `Reservation ${activityId} has already been processed. Current status: ${currentStatus}`,
      400,
      'RESERVATION_ALREADY_PROCESSED',
      { activityId, currentStatus }
    );
    this.name = 'ReservationAlreadyProcessedError';
  }
}

export class TransactionError extends ActivityError {
  constructor(message: string, details?: any) {
    super(`Database transaction failed: ${message}`, 500, 'TRANSACTION_ERROR', details);
    this.name = 'TransactionError';
  }
}

export class ConversationCreationError extends ActivityError {
  constructor(participants: string[], details?: any) {
    super(
      `Failed to create conversation between participants`,
      500,
      'CONVERSATION_CREATION_ERROR',
      { participants, ...details }
    );
    this.name = 'ConversationCreationError';
  }
}

export class NotificationError extends ActivityError {
  constructor(notificationType: string, details?: any) {
    super(
      `Failed to send ${notificationType} notification`,
      500,
      'NOTIFICATION_ERROR',
      { notificationType, ...details }
    );
    this.name = 'NotificationError';
  }
}

/**
 * Fonction utilitaire pour vérifier si une erreur est une erreur d'activité
 */
export function isActivityError(error: any): error is ActivityError {
  return error instanceof ActivityError;
}

/**
 * Fonction pour formater les erreurs d'activité pour l'API
 */
export function formatActivityError(error: ActivityError) {
  return {
    error: {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      details: error.details,
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * Fonction pour log les erreurs d'activité
 */
export function logActivityError(error: ActivityError, context: any = {}) {
  return {
    level: 'error',
    message: error.message,
    code: error.code,
    statusCode: error.statusCode,
    details: error.details,
    context,
    stack: error.stack,
    timestamp: new Date().toISOString()
  };
}