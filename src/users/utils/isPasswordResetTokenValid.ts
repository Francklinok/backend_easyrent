
import { IUser } from "../userTypes/userTypes"; // à adapter à ton arborescence


export function isPasswordResetTokenValid(this: IUser, token: string): boolean {
  return this.passwordResetToken === token &&
         this.passwordResetExpires! > new Date();
}
