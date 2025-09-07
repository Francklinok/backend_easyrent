import { Schema } from "mongoose";
import { PropertyEquipment } from "../types/propertyType";

const EquipmentSchema = new Schema<PropertyEquipment>(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    icon: { type: String, required: true },
    lib: { type: String, required: true },
    category: { type: String, required: true }
  },
  { _id: false } 
);

export default EquipmentSchema