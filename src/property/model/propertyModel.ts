import mongoose, { model, Schema } from 'mongoose';
import { IPropertyDocument } from '../types/propertyType';
import { PropertyStatus } from '../types/propertyType';
import AtoutSchema from './atoutShema';
import EquipmentSchema from './equipmentSchema';

const propertySchema = new Schema<IPropertyDocument>(
  {
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
      index: true,
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, "L'identifiant du propriétaire est requis"],
      index: true,
    },
    actionType: {
      type: String,
      enum: ['rent', 'sell'],
    },
    propertyType: {
      type: String,
      enum: [
        'villa',
        'apartment',
        'home',
        'penthouse',
        'studio',
        'loft',
        'bureau',
        'chalet',
        'hotel',
        'terrain',
        'commercial',
      ],
      required: true,
    },
    island: { type: Boolean, default: false },
    ishome: { type: Boolean, default: true },

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

    generalHInfo: {
      rooms: { type: Number, min: 1, default: 1 },
      bedrooms: { type: Number, min: 0, required: true },
      bathrooms: { type: Number, min: 0, required: true },
      toilets: { type: Number, default: 0 },
      surface: { type: Number, min: 1, required: true },
      area: { type: String, required: true, trim: true },
      furnished: { type: Boolean, default: false },
      pets: { type: Boolean, default: false },
      smoking: { type: Boolean, default: false },
      maxOccupants: { type: Number, min: 1, default: 1 },
    },

    generalLandinfo: {
      surface:{type:Number,min:1,required:true},
      constructible: { type: Boolean, default: true },
      cultivable: { type: Boolean, default: true },
      fence: { type: Boolean, default: false },
    },

    images: {
      type: [String],
      validate: {
        validator: (v: string[]) => v.length > 0,
        message: 'Au moins une image est requise',
      },
      required: true,
    },

    amenities: { type: [String], default: [] },

    availableFrom: { type: Date, required: true, default: Date.now, index: true },

    status: {
      type: String,
      enum: Object.values(PropertyStatus),
      default: PropertyStatus.AVAILABLE,
      index: true,
    },

    isActive: { type: Boolean, default: true, index: true },

    equipments: { type: [EquipmentSchema], default: [] },

    ownerCriteria: {
      monthlyRent: { type: Number, min: 0, required: true },
      isGarantRequired: { type: Boolean, default: false },
      depositAmount: { type: Number, min: 0, default: 0 },
      minimumDuration: { type: Number, default: 1 },
      solvability: {
        type: String,
        enum: ['instant', 'date'],
        default: 'instant',
      },
      guarantorRequired: { type: Boolean, default: false },
      guarantorLocation: {
        type: String,
        enum: ['same', 'different'],
        default: 'same',
      },
      acceptedSituations: { type: [String], default: [] },
      isdocumentRequired: { type: Boolean, default: false },
      requiredDocuments: {
        client: { type: [String], default: [] },
        guarantor: { type: [String], default: [] },
      },
    },

    iserviceAvalaible: { type: Boolean, default: false },

    services: {
      serviceId: {
        type: mongoose.Types.ObjectId,
        ref: 'Services',
        required: true,
        index: true,
      },
    },

    atouts: { type: [AtoutSchema], default: [] },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
propertySchema.index({ 'generalHInfo.area': 1 });
propertySchema.index({ 'ownerCriteria.monthlyRent': 1 });
propertySchema.index({ 'generalHInfo.bedrooms': 1 });
propertySchema.index({ status: 1, isActive: 1 });
propertySchema.index({ 'ownerCriteria.monthlyRent': 1, 'generalHInfo.area': 1 });
propertySchema.index(
  { title: 'text', description: 'text', address: 'text', 'generalHInfo.area': 'text' },
  {
    weights: { title: 10, 'generalHInfo.area': 5, address: 3, description: 1 },
    name: 'property_text_index',
  }
);

// Virtual
propertySchema.virtual('pricePerSquareMeter').get(function (this: IPropertyDocument) {
  return this.generalHInfo.surface > 0
    ? this.ownerCriteria.monthlyRent / this.generalHInfo.surface
    : 0;
});

// Method
propertySchema.methods.isAvailableAt = function (this: IPropertyDocument, date: Date): boolean {
  return date >= this.availableFrom && this.status === PropertyStatus.AVAILABLE;
};

// Pre-save validation
propertySchema.pre('save', function (this: IPropertyDocument, next) {
  if (
    this.generalHInfo.bedrooms + this.generalHInfo.bathrooms >
    this.generalHInfo.rooms
  ) {
    return next(
      new Error(
        'Le nombre total de chambres et salles de bain ne peut pas dépasser le nombre de pièces'
      )
    );
  }
  next();
});

const Property = model<IPropertyDocument>('Property', propertySchema);
export default Property;
