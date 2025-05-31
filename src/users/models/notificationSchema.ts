import { Schema, model } from 'mongoose';
import { UserNotification } from '../types/userTypes';
// Schéma pour les notifications utilisateur
const UserNotificationSchema = new Schema<UserNotification>({
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['info', 'warning', 'error', 'success'],
    default: 'info'
  },
  read: {
    type: Boolean,
    default: false
  },
  readAt: Date,
  link: String,
  metadata: Schema.Types.Mixed
}, {
  timestamps: true
});
export default UserNotificationSchema