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
    isBookingAccepted?:boolean
  };

export interface VisiteData{
  propertyId: Types.ObjectId,
  clientId?: Types.ObjectId,
  message:string,
  isVisited:boolean,
  visitDate:Date
}

export interface AtivityData{
  propertyId: Types.ObjectId,
  clientId?: Types.ObjectId,
  isVisited:boolean,
  activityId: Types.ObjectId,
  conversationId: Types.ObjectId,
  visitDate:Date,
  reservationDate:Date
}


