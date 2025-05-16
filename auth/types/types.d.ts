// types.d.ts ou dans un fichier global
import { Request } from 'express'

declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      id: string
      email?: string
      // Ajoutez d'autres propriétés selon votre modèle utilisateur
    }
}}
