import { Types } from "mongoose";

export interface ActivityType {
  propertyId: Types.ObjectId;
  clientId: Types.ObjectId;
  isVisited: boolean;                
  visitDate: Date;
  isVisitAccepted:boolean;
  isReservation:boolean;
  message:string                                 
  reservationDate: Date;           
  isReservationAccepted: boolean;    
  booking:boolean;                   
  isFileRequired: boolean;           
  documentsUploaded: boolean;        
  uploadedFiles: {                  
      fileName: string;
      fileUrl: string;
      uploadedAt: Date;
    }[];
  isBookingAccepted?:boolean;
  isPayment?:boolean;
  amount:number,
  paymentDate:Date,
  conversationId?: Types.ObjectId,
  reason?:string,
  refusDate?:Date,
  acceptedDate?:Date,
  activityId: Types.ObjectId,
  createdAt: Date;


  };

export interface VisiteData{
  propertyId: Types.ObjectId,
  clientId?: Types.ObjectId,
  message:string,
  visitDate:Date
}

export interface ActivityData{
  activityId: Types.ObjectId,
  reservationDate:Date
  documentsUploaded: boolean;        
  uploadedFiles?: {                  
      fileName: string;
      fileUrl: string;
      uploadedAt: Date;
    }[];
}

export interface AcceptReservation{
  activityId: Types.ObjectId,
  acceptedDate:Date,
}
export interface RefuseReservation{
  activityId: Types.ObjectId,
  refusDate:Date,
  reason:string
}

export interface ActivityPayment{
  activityId: Types.ObjectId,
  isBookingAccepted:boolean,
  amount:number,
  isPayment?:boolean;
  paymentDate:Date
}

