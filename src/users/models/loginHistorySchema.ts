import { Schema, model } from "mongoose";
import { LoginHistory } from "../userTypes/userTypes";

const loginHistorySchema = new Schema<LoginHistory>({
    timestamp: { 
        type: Date, 
        default: Date.now
     },
    ipAddress: {
         type: String,
          required: true
         },
    userAgent: { 
        type: String,
         required: true 
        },
    location: String,
    deviceId: String,
    successful: { 
        type: Boolean,
         required: true 
        }

})

// const LoginHistory = model("LoginHistory", LoginHistorySchema)
export default loginHistorySchema;