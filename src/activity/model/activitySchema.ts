import mongoose, { Schema, Document } from "mongoose";
import { ActivityType } from "../types/activityType";

// On étend Document pour que Mongoose comprenne le type
export interface IActivity extends ActivityType, Document {}

const UploadedFileSchema = new Schema({
  fileName: { type: String, required: true },
  fileUrl: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now },
});

const ActivitySchema = new Schema<IActivity>(
  {
    
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(), 
      ref: "Property",
      required: true,
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(), 
      ref: "User",
      required: true,
    },

    isVisited: { type: Boolean, default: false },
    visitDate: { type: Date },
    isVisiteAcccepted:{type:Boolean, default:true},
    isReservation: { type: Boolean, default: false },
    message: { type: String, default: "", required: true }, 
    reservationDate: { type: Date, default: Date.now },
    isReservationAccepted: { type: Boolean, default: false },
    booking:{ type: Boolean, default: false },
    documentsUploaded: { type: Boolean, default: false },
    isBookingAccepted: { type: Boolean, default: false },
    uploadedFiles: { type: [UploadedFileSchema], default: [] },
    },
  { timestamps: true }
);

// Correction du mot-clé export
const Activity = mongoose.model<IActivity>("Activity", ActivitySchema);

export default Activity;

