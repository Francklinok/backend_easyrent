
import { Document } from 'mongoose';
import { ObjectId } from 'mongodb';


export interface appConfig {
  port:number,
  env:string,
  host?:string,
}

/**
 * Interface représentant un événement d'audit de sécurité
 */
export interface SecurityAuditEvent extends Document {
  _id: ObjectId;
  eventType: string;
  userId?: ObjectId;
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
  details: Record<string, any>;
}
