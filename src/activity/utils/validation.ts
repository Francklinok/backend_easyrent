import { Types } from 'mongoose';
import {
  VisiteData,
  ActivityData,
  AcceptReservation,
  RefuseReservation,
  ActivityPayment
} from '../types/activityType';
import { ActivityError } from './errors';

/**
 * Classe de validation pour les données d'activité
 */
export class ActivityValidator {

  /**
   * Valide les données de visite
   */
  static validateVisitData(data: VisiteData): void {
    if (!data.propertyId || !Types.ObjectId.isValid(data.propertyId)) {
      throw new ActivityError('PropertyId is required and must be a valid ObjectId', 400, 'INVALID_PROPERTY_ID');
    }

    if (!data.clientId || !Types.ObjectId.isValid(data.clientId)) {
      throw new ActivityError('ClientId is required and must be a valid ObjectId', 400, 'INVALID_CLIENT_ID');
    }

    if (!data.message || typeof data.message !== 'string' || data.message.trim().length === 0) {
      throw new ActivityError('Message is required and must be a non-empty string', 400, 'INVALID_MESSAGE');
    }

    if (data.message.length > 500) {
      throw new ActivityError('Message must not exceed 500 characters', 400, 'MESSAGE_TOO_LONG');
    }

    if (data.visitDate) {
      const visitDate = new Date(data.visitDate);
      const now = new Date();

      if (isNaN(visitDate.getTime())) {
        throw new ActivityError('Invalid visit date format', 400, 'INVALID_VISIT_DATE');
      }

      // La date de visite ne peut pas être dans le passé (avec une marge de 1 heure)
      if (visitDate < new Date(now.getTime() - 60 * 60 * 1000)) {
        throw new ActivityError('Visit date cannot be in the past', 400, 'VISIT_DATE_IN_PAST');
      }

      // La date de visite ne peut pas être trop loin dans le futur (6 mois)
      const sixMonthsFromNow = new Date(now.getTime() + 6 * 30 * 24 * 60 * 60 * 1000);
      if (visitDate > sixMonthsFromNow) {
        throw new ActivityError('Visit date cannot be more than 6 months in the future', 400, 'VISIT_DATE_TOO_FAR');
      }
    }
  }

  /**
   * Valide les données de réservation
   */
  static validateReservationData(data: ActivityData): void {
    if (!data.activityId || !Types.ObjectId.isValid(data.activityId)) {
      throw new ActivityError('ActivityId is required and must be a valid ObjectId', 400, 'INVALID_ACTIVITY_ID');
    }

    if (data.reservationDate) {
      const reservationDate = new Date(data.reservationDate);
      const now = new Date();

      if (isNaN(reservationDate.getTime())) {
        throw new ActivityError('Invalid reservation date format', 400, 'INVALID_RESERVATION_DATE');
      }

      if (reservationDate < new Date(now.getTime() - 60 * 60 * 1000)) {
        throw new ActivityError('Reservation date cannot be in the past', 400, 'RESERVATION_DATE_IN_PAST');
      }
    }

    if (data.uploadedFiles) {
      if (!Array.isArray(data.uploadedFiles)) {
        throw new ActivityError('UploadedFiles must be an array', 400, 'INVALID_UPLOADED_FILES');
      }

      data.uploadedFiles.forEach((file, index) => {
        if (!file.fileName || typeof file.fileName !== 'string') {
          throw new ActivityError(`File at index ${index} must have a valid fileName`, 400, 'INVALID_FILE_NAME');
        }

        if (!file.fileUrl || typeof file.fileUrl !== 'string') {
          throw new ActivityError(`File at index ${index} must have a valid fileUrl`, 400, 'INVALID_FILE_URL');
        }

        if (!file.uploadedAt || isNaN(new Date(file.uploadedAt).getTime())) {
          throw new ActivityError(`File at index ${index} must have a valid uploadedAt date`, 400, 'INVALID_FILE_DATE');
        }
      });
    }
  }

  /**
   * Valide les données d'acceptation de réservation
   */
  static validateAcceptReservation(data: AcceptReservation): void {
    if (!data.activityId || !Types.ObjectId.isValid(data.activityId)) {
      throw new ActivityError('ActivityId is required and must be a valid ObjectId', 400, 'INVALID_ACTIVITY_ID');
    }

    if (data.acceptedDate) {
      const acceptedDate = new Date(data.acceptedDate);

      if (isNaN(acceptedDate.getTime())) {
        throw new ActivityError('Invalid accepted date format', 400, 'INVALID_ACCEPTED_DATE');
      }
    }
  }

  /**
   * Valide les données de refus de réservation
   */
  static validateRefuseReservation(data: RefuseReservation): void {
    if (!data.activityId || !Types.ObjectId.isValid(data.activityId)) {
      throw new ActivityError('ActivityId is required and must be a valid ObjectId', 400, 'INVALID_ACTIVITY_ID');
    }

    if (!data.reason || typeof data.reason !== 'string' || data.reason.trim().length === 0) {
      throw new ActivityError('Reason is required for reservation refusal', 400, 'REASON_REQUIRED');
    }

    if (data.reason.length > 1000) {
      throw new ActivityError('Reason must not exceed 1000 characters', 400, 'REASON_TOO_LONG');
    }

    if (data.refusDate) {
      const refusDate = new Date(data.refusDate);

      if (isNaN(refusDate.getTime())) {
        throw new ActivityError('Invalid refusal date format', 400, 'INVALID_REFUSAL_DATE');
      }
    }
  }

  /**
   * Valide les données de paiement
   */
  static validatePaymentData(data: ActivityPayment): void {
    if (!data.activityId || !Types.ObjectId.isValid(data.activityId)) {
      throw new ActivityError('ActivityId is required and must be a valid ObjectId', 400, 'INVALID_ACTIVITY_ID');
    }

    if (!data.amount || typeof data.amount !== 'number' || data.amount <= 0) {
      throw new ActivityError('Amount is required and must be a positive number', 400, 'INVALID_AMOUNT');
    }

    if (data.amount > 1000000) {
      throw new ActivityError('Amount cannot exceed 1,000,000', 400, 'AMOUNT_TOO_HIGH');
    }

    // Vérifier que le montant a au maximum 2 décimales
    if (Number.isInteger(data.amount * 100) === false) {
      throw new ActivityError('Amount can have at most 2 decimal places', 400, 'INVALID_AMOUNT_PRECISION');
    }

    if (data.paymentDate) {
      const paymentDate = new Date(data.paymentDate);

      if (isNaN(paymentDate.getTime())) {
        throw new ActivityError('Invalid payment date format', 400, 'INVALID_PAYMENT_DATE');
      }
    }
  }

  /**
   * Valide les paramètres de pagination
   */
  static validatePagination(page: number, limit: number): { page: number; limit: number } {
    let validPage = parseInt(String(page), 10);
    let validLimit = parseInt(String(limit), 10);

    if (isNaN(validPage) || validPage < 1) {
      validPage = 1;
    }

    if (isNaN(validLimit) || validLimit < 1) {
      validLimit = 10;
    }

    if (validLimit > 100) {
      validLimit = 100;
    }

    return { page: validPage, limit: validLimit };
  }

  /**
   * Valide un ObjectId MongoDB
   */
  static validateObjectId(id: string, fieldName: string = 'id'): void {
    if (!id || !Types.ObjectId.isValid(id)) {
      throw new ActivityError(`${fieldName} must be a valid ObjectId`, 400, 'INVALID_OBJECT_ID');
    }
  }

  /**
   * Valide une date
   */
  static validateDate(date: any, fieldName: string = 'date', required: boolean = true): Date | null {
    if (!date) {
      if (required) {
        throw new ActivityError(`${fieldName} is required`, 400, 'DATE_REQUIRED');
      }
      return null;
    }

    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      throw new ActivityError(`${fieldName} must be a valid date`, 400, 'INVALID_DATE');
    }

    return parsedDate;
  }

  /**
   * Valide une chaîne de caractères
   */
  static validateString(
    value: any,
    fieldName: string,
    required: boolean = true,
    minLength: number = 0,
    maxLength: number = Infinity
  ): string | null {
    if (!value || typeof value !== 'string') {
      if (required) {
        throw new ActivityError(`${fieldName} is required and must be a string`, 400, 'STRING_REQUIRED');
      }
      return null;
    }

    const trimmedValue = value.trim();

    if (trimmedValue.length < minLength) {
      throw new ActivityError(
        `${fieldName} must be at least ${minLength} characters long`,
        400,
        'STRING_TOO_SHORT'
      );
    }

    if (trimmedValue.length > maxLength) {
      throw new ActivityError(
        `${fieldName} must not exceed ${maxLength} characters`,
        400,
        'STRING_TOO_LONG'
      );
    }

    return trimmedValue;
  }

  /**
   * Valide un nombre
   */
  static validateNumber(
    value: any,
    fieldName: string,
    required: boolean = true,
    min: number = -Infinity,
    max: number = Infinity
  ): number | null {
    if (value === null || value === undefined) {
      if (required) {
        throw new ActivityError(`${fieldName} is required`, 400, 'NUMBER_REQUIRED');
      }
      return null;
    }

    const numValue = Number(value);
    if (isNaN(numValue)) {
      throw new ActivityError(`${fieldName} must be a valid number`, 400, 'INVALID_NUMBER');
    }

    if (numValue < min) {
      throw new ActivityError(`${fieldName} must be at least ${min}`, 400, 'NUMBER_TOO_LOW');
    }

    if (numValue > max) {
      throw new ActivityError(`${fieldName} must not exceed ${max}`, 400, 'NUMBER_TOO_HIGH');
    }

    return numValue;
  }
}