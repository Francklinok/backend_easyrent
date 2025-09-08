import { Types } from "mongoose";

export interface ActivityType {
  propertyId: Types.ObjectId;
  clientId: Types.ObjectId;
  isVisited: boolean;                
  visitDate: Date;
  isVisiteAcccepted:boolean;
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
  amout:number,
  payementDate:Date,
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

export interface AtivityData{
  activityId: Types.ObjectId,
  reservationDate:Date
  documentsUploaded: boolean;        
  uploadedFiles?: {                  
      fileName: string;
      fileUrl: string;
      uploadedAt: Date;
    }[];
}

export interface AccepteReservation{
  activityId: Types.ObjectId,
  acceptedDate:Date,
}
export interface RefusReservation{
  activityId: Types.ObjectId,
  refusDate:Date,
  reason:string
}

export  interface ActiviytyPayement{
  activityId: Types.ObjectId,
  isBookingAccepted:boolean,
  amount:number,
  isPayment?:boolean;
  payementDate:Date,
}

