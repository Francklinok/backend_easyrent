import mongoose, { Schema, Document } from 'mongoose';

export interface IDynamicPricing extends Document {
  propertyId: mongoose.Types.ObjectId;
  baseRent: number;
  currentYieldRate: number;
  adjustedRent: number;
  pricingTier: 'low' | 'medium' | 'high';
  discountPercentage: number;
  lastUpdate: Date;
  smoothingFactor: number;
  historicalYields: Array<{
    date: Date;
    yieldRate: number;
    discountApplied: number;
  }>;
  isActive: boolean;

  // Methods
  calculateDiscount(yieldRate: number): number;
  updatePricing(newYieldRate: number): void;
}

const dynamicPricingSchema = new Schema<IDynamicPricing>({
  propertyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    required: true,
    index: true
  },
  baseRent: {
    type: Number,
    required: true,
    min: 0
  },
  currentYieldRate: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  adjustedRent: {
    type: Number,
    required: true,
    min: 0
  },
  pricingTier: {
    type: String,
    enum: ['low', 'medium', 'high'],
    required: true
  },
  discountPercentage: {
    type: Number,
    required: true,
    min: 0,
    max: 50
  },
  lastUpdate: {
    type: Date,
    default: Date.now,
    index: true
  },
  smoothingFactor: {
    type: Number,
    default: 0.3,
    min: 0.1,
    max: 1
  },
  historicalYields: [{
    date: {
      type: Date,
      required: true
    },
    yieldRate: {
      type: Number,
      required: true
    },
    discountApplied: {
      type: Number,
      required: true
    }
  }],
  isActive: {
    type: Boolean,
    default: true,
    index: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true }
});

// Indexes for performance
dynamicPricingSchema.index({ propertyId: 1, lastUpdate: -1 });
dynamicPricingSchema.index({ pricingTier: 1, isActive: 1 });

// Methods
dynamicPricingSchema.methods.calculateDiscount = function(yieldRate: number): number {
  if (yieldRate < 8) return 5; // 95% du loyer
  if (yieldRate >= 8 && yieldRate <= 15) return 10; // 90% du loyer
  if (yieldRate > 15) return 15; // 85% du loyer
  return 0;
};

dynamicPricingSchema.methods.updatePricing = function(newYieldRate: number) {
  const previousYield = this.currentYieldRate;

  // Lissage pour éviter les variations brutales
  const smoothedYield = (newYieldRate * this.smoothingFactor) +
                       (previousYield * (1 - this.smoothingFactor));

  this.currentYieldRate = smoothedYield;
  this.discountPercentage = this.calculateDiscount(smoothedYield);
  this.adjustedRent = this.baseRent * (1 - this.discountPercentage / 100);

  // Déterminer le tier
  if (smoothedYield < 8) this.pricingTier = 'low';
  else if (smoothedYield <= 15) this.pricingTier = 'medium';
  else this.pricingTier = 'high';

  // Ajouter à l'historique
  this.historicalYields.push({
    date: new Date(),
    yieldRate: smoothedYield,
    discountApplied: this.discountPercentage
  });

  // Garder seulement les 30 derniers enregistrements
  if (this.historicalYields.length > 30) {
    this.historicalYields = this.historicalYields.slice(-30);
  }

  this.lastUpdate = new Date();
};

export const DynamicPricing = mongoose.model<IDynamicPricing>('DynamicPricing', dynamicPricingSchema);