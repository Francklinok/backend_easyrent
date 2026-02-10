
export type MessageType =
  | 'visit_request'
  | 'visit_accepted'
  | 'visit_rejected'
  | 'reservation_request'
  | 'reservation_accepted'
  | 'reservation_rejected'
  | 'payment_confirmed'
  | 'payment_received';

export interface PropertyInfo {
  title: string;
  address?: string;
}

export interface UserInfo {
  firstName: string;
  lastName: string;
}

export interface VisitInfo {
  date: Date;
  message?: string;
}

export interface ReservationInfo {
  startDate?: Date;
  endDate?: Date;
  numberOfOccupants?: number;
  monthlyIncome?: number;
  hasGuarantor?: boolean;
  budget?: number;
  financingType?: string;
  timeframe?: string;
  message?: string;
}

// Short date format (e.g. "15 janv. 2024")
const formatDateShort = (date: Date): string => {
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
};

// Long date format (e.g. "15 janvier 2024")
const formatDateLong = (date: Date): string => {
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
};

// Time format (e.g. "14:30")
const formatTime = (date: Date): string => {
  return date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Chat messages (long format, displayed in conversation)
 */
export const ChatMessages = {
  visitRequest: (property: PropertyInfo, visit: VisitInfo): string => {
    let msg = `DEMANDE DE VISITE\n${property.title}`;
    if (property.address) msg += `\n${property.address}`;
    msg += `\n${formatDateShort(visit.date)} à ${formatTime(visit.date)}`;
    if (visit.message) msg += `\n\n${visit.message}`;
    return msg;
  },

  visitAccepted: (property: PropertyInfo, visitDate?: Date): string => {
    let msg = `VISITE ACCEPTEE\n${property.title}`;
    if (visitDate) msg += `\n${formatDateShort(visitDate)}`;
    return msg;
  },

  visitRejected: (property: PropertyInfo, reason?: string): string => {
    let msg = `VISITE REFUSEE\n${property.title}`;
    if (reason) msg += `\n\n${reason}`;
    return msg;
  },

  reservationRequest: (property: PropertyInfo, reservation: ReservationInfo, isForSale: boolean): string => {
    if (isForSale) {
      let msg = `DEMANDE D'ACQUISITION\n${property.title}`;
      msg += `\nBudget: ${reservation.budget?.toLocaleString() || 'A definir'} EUR`;
      msg += `\nFinancement: ${reservation.financingType || 'A definir'}`;
      msg += `\nDelai: ${reservation.timeframe || 'Flexible'}`;
      if (reservation.message) msg += `\n\n${reservation.message}`;
      return msg;
    } else {
      let msg = `DEMANDE DE RESERVATION\n${property.title}`;
      if (reservation.startDate && reservation.endDate) {
        msg += `\n${formatDateLong(reservation.startDate)} - ${formatDateLong(reservation.endDate)}`;
      }
      const details: string[] = [];
      if (reservation.numberOfOccupants) {
        details.push(`${reservation.numberOfOccupants} occupant${reservation.numberOfOccupants > 1 ? 's' : ''}`);
      }
      if (reservation.monthlyIncome) {
        details.push(`Revenu: ${reservation.monthlyIncome.toLocaleString()} EUR`);
      }
      if (reservation.hasGuarantor) {
        details.push('Garant: Oui');
      }
      if (details.length > 0) {
        msg += `\n${details.join(' | ')}`;
      }
      if (reservation.message) msg += `\n\n${reservation.message}`;
      return msg;
    }
  },

  reservationAccepted: (property: PropertyInfo, date: Date): string => {
    return `RESERVATION ACCEPTEE\n${property.title}\n${formatDateShort(date)}`;
  },

  reservationRejected: (property: PropertyInfo, reason?: string): string => {
    let msg = `RESERVATION REFUSEE\n${property.title}`;
    if (reason) msg += `\n\n${reason}`;
    return msg;
  },

  paymentConfirmed: (property: PropertyInfo, amount: number, date: Date): string => {
    return `PAIEMENT CONFIRME\n${property.title}\n${amount.toLocaleString()} EUR\n${formatDateShort(date)}`;
  }
};

/**
 * Notification titles (short format, for push/in-app)
 */
export const NotificationTitles = {
  visit_request: 'Nouvelle demande de visite',
  visit_request_sent: 'Demande de visite envoyee',
  visit_accepted: 'Visite acceptee',
  visit_rejected: 'Visite refusee',
  reservation_request: 'Nouvelle demande de reservation',
  reservation_request_sent: 'Demande de reservation envoyee',
  reservation_accepted: 'Reservation acceptee',
  reservation_rejected: 'Reservation refusee',
  payment_confirmed: 'Paiement confirme',
  payment_received: 'Paiement recu'
};

/**
 * Notification messages (short format, for push/in-app)
 */
export const NotificationMessages = {
  // For the property owner
  visitRequestToOwner: (client: UserInfo, property: PropertyInfo): string => {
    return `${client.firstName} ${client.lastName} souhaite visiter "${property.title}"`;
  },

  reservationRequestToOwner: (client: UserInfo, property: PropertyInfo): string => {
    return `${client.firstName} ${client.lastName} souhaite reserver "${property.title}"`;
  },

  paymentReceivedToOwner: (client: UserInfo, property: PropertyInfo, amount: number): string => {
    return `Paiement de ${amount.toLocaleString()} EUR recu de ${client.firstName} ${client.lastName} pour "${property.title}"`;
  },

  // For the client
  visitRequestSentToClient: (property: PropertyInfo): string => {
    return `Votre demande de visite pour "${property.title}" a ete envoyee`;
  },

  visitResponseToClient: (property: PropertyInfo, accepted: boolean): string => {
    const status = accepted ? 'acceptee' : 'refusee';
    return `Votre demande de visite pour "${property.title}" a ete ${status}`;
  },

  reservationRequestSentToClient: (property: PropertyInfo): string => {
    return `Votre demande de reservation pour "${property.title}" a ete envoyee`;
  },

  reservationResponseToClient: (property: PropertyInfo, accepted: boolean, reason?: string): string => {
    if (accepted) {
      return `Votre reservation pour "${property.title}" a ete acceptee`;
    }
    let msg = `Votre reservation pour "${property.title}" a ete refusee`;
    if (reason) msg += `. ${reason}`;
    return msg;
  },

  paymentConfirmedToClient: (property: PropertyInfo, amount: number): string => {
    return `Paiement de ${amount.toLocaleString()} EUR confirme pour "${property.title}"`;
  }
};

export default {
  ChatMessages,
  NotificationTitles,
  NotificationMessages,
  formatDateShort,
  formatDateLong,
  formatTime
};
