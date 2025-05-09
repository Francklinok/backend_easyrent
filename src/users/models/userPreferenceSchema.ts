import { Schema, model } from "mongoose";

const userPreferencesSchema = new Schema({
  theme: { 
    type: String,
     enum: ['light', 'dark', 'system'], default: 'system'
     },
  language: { 
    type: String, 
    default: 'fr'
 },
  emailNotifications: { 
    type: Boolean, 
    default: true
 },
  pushNotifications: { 
    type: Boolean, 
    default: false 
},
  smsNotifications: { 
    type: Boolean,
     default: false
     },
  twoFactorEnabled: {
     type: Boolean, 
     default: false 
    },
  marketingCommunications: {
     type: Boolean,
      default: false
     }
});

// const  userPreferences = model("userPreferences",  userPreferencesSchema)
export default userPreferencesSchema