import { IUser } from "../../models/userModel/userModel";
import { Document } from "mongoose";
import bcrypt from 'bcrypt';



export async function hashPasswordMiddleware(this: IUser & Document, next: Function) {
  // Ne hacher le mot de passe que s'il a été modifié
  if (!this.isModified('password')) {
    return next();
  }
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error: any) {
    next(error);
  }
}