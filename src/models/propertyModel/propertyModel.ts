import mongoose, { model, Schema } from 'mongoose';
import { Types } from 'mongoose';
import { IProperty } from '../../type/propertyType';
import { PropertyStatus } from '../../type/propertyType';
import { IPropertyDocument } from '../../type/propertyType';

/**
 * Schéma de propriété pour l'application de location immobilière
 * Modèle robuste avec validation, par défaut, et hooks appropriés
 */
const propertySchema = new Schema<IPropertyDocument>(
  {
    title: {
      type: String,
      maxlength: [50, 'Le titre ne peut pas dépasser 50 caractères'],
      required: [true, 'Le titre est requis'],
      trim: true,
    },
    description: {
      type: String,
      minlength: [80, 'La description doit contenir au moins 80 caractères'],
      required: [true, 'La description est requise'],
      trim: true,
    },
    address: {
      type: String,
      minlength: [10, "L'adresse doit contenir au moins 10 caractères"],
      required: [true, "L'adresse est requise"],
      trim: true,
    },
    monthlyRent: {
      type: Number,
      required: [true, 'Le loyer mensuel est requis'],
      min: [0, 'Le loyer mensuel doit être un nombre positif'],
    },
    depositAmount: {
      type: Number,
      min: [0, 'Le montant de la caution doit être un nombre positif'],
      default: 0,
    },
    maxOccupants: {
      type: Number,
      min: [1, "Le nombre maximum d'occupants doit être au moins 1"],
      default: 1,
    },
    bedrooms: {
      type: Number,
      required: [true, 'Le nombre de chambres est requis'],
      min: [0, 'Le nombre de chambres doit être un nombre positif'],
    },
    bathrooms: {
      type: Number,
      required: [true, 'Le nombre de salles de bain est requis'],
      min: [0, 'Le nombre de salles de bain doit être un nombre positif'],
    },
    area: {
      type: String,
      required: [true, 'La zone/quartier est requise'],
      trim: true,
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, "L'identifiant du propriétaire est requis"],
      index: true,
    },
    images: {
      type: [String],
      validate: {
        validator: function (v: string[]) {
          return v.length > 0;
        },
        message: 'Au moins une image est requise',
      },
      required: [true, 'Les images sont requises'],
    },
    amenities: {
      type: [String],
      default: [],
    },
    availableFrom: {
      type: Date,
      required: [true, 'La date de disponibilité est requise'],
      default: Date.now,
      index: true,
    },
    surface: {
      type: Number,
      required: [true, 'La surface est requise'],
      min: [1, 'La surface doit être un nombre positif'],
    },
    rooms: {
      type: Number,
      min: [1, 'Le nombre de pièces doit être au moins 1'],
      default: 1,
    },
    status: {
      type: String,
      enum: Object.values(PropertyStatus),
      default: PropertyStatus.AVAILABLE,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true, // Crée automatiquement createdAt et updatedAt
    toJSON: { virtuals: true }, // Inclut les champs virtuels lors de la conversion en JSON
    toObject: { virtuals: true }, // Inclut les champs virtuels lors de la conversion en objet
  }
);

// Indexation pour améliorer les performances des requêtes fréquentes
propertySchema.index({ area: 1 });
propertySchema.index({ monthlyRent: 1 });
propertySchema.index({ bedrooms: 1 });
propertySchema.index({ 'status': 1, 'isActive': 1 });
propertySchema.index({ monthlyRent: 1, area: 1 });
propertySchema.index({ 
  title: 'text', 
  description: 'text', 
  address: 'text', 
  area: 'text' 
}, {
  weights: {
    title: 10,
    area: 5,
    address: 3,
    description: 1
  },
  name: 'property_text_index'
});

// Champ virtuel pour calculer le prix par mètre carré
propertySchema.virtual('pricePerSquareMeter').get(function (this: IPropertyDocument) {
  return this.surface > 0 ? this.monthlyRent / this.surface : 0;
});

// Méthode pour vérifier si la propriété est disponible à une date donnée
propertySchema.methods.isAvailableAt = function (this: IPropertyDocument, date: Date): boolean {
  return date >= this.availableFrom && this.status === PropertyStatus.AVAILABLE;
};

// Middleware pre-save pour la validation supplémentaire
propertySchema.pre('save', function (this: IPropertyDocument, next) {
  // Validation personnalisée
  if (this.bedrooms + this.bathrooms > this.rooms) {
    return next(
      new Error('Le nombre total de chambres et salles de bain ne peut pas dépasser le nombre de pièces')
    );
  }
  next();
});

// Création du modèle
const Property = model<IPropertyDocument>('Property', propertySchema);

export default Property;
