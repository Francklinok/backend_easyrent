import mongoose, { Schema } from "mongoose";
import { PropertyAtout } from "../types/propertyType";

const AtoutSchema = new Schema<PropertyAtout>({
    id: { type: String, required: true },
    type: {
      type: String,
      enum: ["predefined", "custom_text", "custom_icon"],
      required: true,
    },
    text: { type: String, required: true },
    icon: { type: String }, 
    lib: { type: String }, 
    category: { type: String, required: true }, 
    verified: { type: Boolean, default: false },
    priority: { type: Number, default: 0 },
    customIcon: { type: Boolean, default: false },
  },
  { _id: false } 
); 

export default AtoutSchema