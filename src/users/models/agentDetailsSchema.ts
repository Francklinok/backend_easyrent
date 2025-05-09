import { Schema, model } from 'mongoose';
import { AgentDetails } from '../userTypes/userTypes';
import { VerificationStatus } from '../userTypes/userTypes';



const agentDetailsSchema = new Schema<AgentDetails>({
  licenseNumber: { 
    type: String,
     required: true
     },
  licenseExpiryDate: { 
    type: Date,
     required: true
     },
  agency: { 
    type: String,
     required: true
     },
  specializations: [{
     type: String
     }],
  yearsOfExperience: {
     type: Number, 
     default: 0 
    },
  verificationStatus: { 
    type: String, 
    enum: Object.values(VerificationStatus),
    default: VerificationStatus.UNVERIFIED
  },
  verificationDocuments: [{ 
    type: String
 }],
  verificationDate: { 
    type: Date 
},
  rating: { 
    type: Number, 
    min: 0,
     max: 5
     },
  reviewCount: { 
    type: Number,
     default: 0
     }
});

// const  agentDetails = model("agentDetails",  agentDetailsSchema)
export default agentDetailsSchema