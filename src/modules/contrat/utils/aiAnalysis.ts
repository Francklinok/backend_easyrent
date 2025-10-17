import { Contract, ContractTemplate } from '../types';

export interface AIAnalysisResult {
  riskScore: number;
  complianceScore: number;
  marketAnalysis: string;
  recommendations: string[];
  detailedAnalysis: {
    financialRisk: number;
    legalCompliance: number;
    marketPosition: number;
    documentQuality: number;
  };
  flags: string[];
  suggestions: string[];
}

export class AIAnalysisService {
  static async analyzeContract(contract: Contract, template: ContractTemplate): Promise<AIAnalysisResult> {
    try {
      // Analyse des risques financiers
      const financialRisk = await this.analyzeFinancialRisk(contract);

      // Analyse de la conformité légale
      const legalCompliance = await this.analyzeLegalCompliance(contract, template);

      // Analyse de la position sur le marché
      const marketPosition = await this.analyzeMarketPosition(contract);

      // Analyse de la qualité du document
      const documentQuality = await this.analyzeDocumentQuality(contract, template);

      // Calcul des scores globaux
      const riskScore = this.calculateRiskScore(financialRisk, legalCompliance, marketPosition);
      const complianceScore = this.calculateComplianceScore(legalCompliance, documentQuality);

      // Génération des recommandations
      const recommendations = this.generateRecommendations(contract, {
        financialRisk,
        legalCompliance,
        marketPosition,
        documentQuality
      });

      // Analyse du marché
      const marketAnalysis = this.getMarketAnalysis(contract);

      // Détection des flags
      const flags = this.detectFlags(contract, { financialRisk, legalCompliance, marketPosition, documentQuality });

      // Suggestions d'amélioration
      const suggestions = this.generateSuggestions(contract, template);

      return {
        riskScore,
        complianceScore,
        marketAnalysis,
        recommendations,
        detailedAnalysis: {
          financialRisk,
          legalCompliance,
          marketPosition,
          documentQuality
        },
        flags,
        suggestions
      };
    } catch (error) {
      console.error('AI Analysis Error:', error);

      // Retourner des valeurs par défaut en cas d'erreur
      return {
        riskScore: 75,
        complianceScore: 85,
        marketAnalysis: 'Analyse non disponible',
        recommendations: ['Vérification manuelle recommandée'],
        detailedAnalysis: {
          financialRisk: 75,
          legalCompliance: 85,
          marketPosition: 80,
          documentQuality: 85
        },
        flags: ['Erreur d\'analyse automatique'],
        suggestions: ['Révision manuelle nécessaire']
      };
    }
  }

  private static async analyzeFinancialRisk(contract: Contract): Promise<number> {
    let score = 90; // Score de base élevé

    const variables = contract.variables;

    // Analyse du loyer par rapport au marché
    if (variables.monthlyRent) {
      const rent = Number(variables.monthlyRent);

      // Vérification des seuils de loyer
      if (rent < 300) {
        score -= 20; // Loyer très bas, risque de sous-évaluation
      } else if (rent > 3000) {
        score -= 10; // Loyer élevé, marché plus risqué
      }

      // Analyse du ratio dépôt/loyer
      if (variables.depositAmount) {
        const deposit = Number(variables.depositAmount);
        const ratio = deposit / rent;

        if (ratio < 0.5) {
          score -= 15; // Dépôt trop faible
        } else if (ratio > 3) {
          score -= 10; // Dépôt excessif, peut indiquer des problèmes
        }
      }
    }

    // Analyse de la durée du contrat
    if (variables.startDate && variables.endDate) {
      const start = new Date(variables.startDate);
      const end = new Date(variables.endDate);
      const durationMonths = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30);

      if (durationMonths < 6) {
        score -= 15; // Contrat très court, risque élevé
      } else if (durationMonths > 60) {
        score -= 5; // Contrat très long, risque modéré
      }
    }

    // Analyse du type de contrat
    switch (contract.type) {
      case 'vacation_rental':
        score -= 5; // Plus de volatilité
        break;
      case 'commercial_rental':
        score -= 10; // Risque commercial plus élevé
        break;
      case 'sublease':
        score -= 15; // Risque de sous-location
        break;
    }

    return Math.max(0, Math.min(100, score));
  }

  private static async analyzeLegalCompliance(contract: Contract, template: ContractTemplate): Promise<number> {
    let score = 95; // Score de base très élevé

    // Vérifier la présence des clauses légales obligatoires
    const requiredClauses = template.legalClauses.filter(clause => clause.isRequired);
    if (requiredClauses.length === 0) {
      score -= 20; // Aucune clause légale définie
    }

    // Vérifier les variables obligatoires
    const requiredVariables = template.variables.filter(v => v.required);
    const missingVariables = requiredVariables.filter(v =>
      !(v.key in contract.variables) ||
      contract.variables[v.key] === null ||
      contract.variables[v.key] === undefined
    );

    score -= missingVariables.length * 5; // -5 points par variable manquante

    // Vérifications spécifiques selon le type de contrat
    switch (contract.type) {
      case 'rental':
        if (!contract.variables.monthlyRent) score -= 10;
        if (!contract.variables.depositAmount) score -= 5;
        if (!contract.variables.startDate) score -= 10;
        if (!contract.variables.endDate) score -= 10;
        break;

      case 'purchase':
        if (!contract.variables.salePrice) score -= 15;
        if (!contract.variables.downPayment) score -= 10;
        if (!contract.variables.closingDate) score -= 10;
        break;

      case 'vacation_rental':
        if (!contract.variables.checkInDate) score -= 10;
        if (!contract.variables.checkOutDate) score -= 10;
        if (!contract.variables.dailyRate) score -= 10;
        break;
    }

    // Vérifier la cohérence des parties
    if (!contract.parties || contract.parties.length < 2) {
      score -= 20; // Contrat doit avoir au moins 2 parties
    }

    return Math.max(0, Math.min(100, score));
  }

  private static async analyzeMarketPosition(contract: Contract): Promise<number> {
    let score = 80; // Score de base

    const variables = contract.variables;

    // Simulation d'analyse de marché basée sur les données du contrat
    if (variables.monthlyRent) {
      const rent = Number(variables.monthlyRent);

      // Analyse par tranche de loyer
      if (rent >= 800 && rent <= 1500) {
        score += 10; // Segment de marché stable
      } else if (rent > 2000) {
        score += 5; // Marché haut de gamme
      } else if (rent < 500) {
        score -= 5; // Marché bas de gamme, plus volatil
      }
    }

    // Analyse de la surface (si disponible)
    if (variables.surface) {
      const surface = Number(variables.surface);
      if (surface >= 40 && surface <= 100) {
        score += 5; // Taille standard, demande stable
      }
    }

    // Analyse saisonnière pour les locations de vacances
    if (contract.type === 'vacation_rental') {
      const now = new Date();
      const month = now.getMonth();

      // Bonus pour les mois de haute saison (été)
      if (month >= 5 && month <= 8) {
        score += 10;
      } else if (month >= 11 || month <= 2) {
        score -= 5; // Basse saison
      }
    }

    // Tendances par type de contrat
    switch (contract.type) {
      case 'rental':
        score += 5; // Marché locatif stable
        break;
      case 'purchase':
        score += 0; // Neutre
        break;
      case 'vacation_rental':
        score -= 5; // Plus volatil
        break;
      case 'commercial_rental':
        score -= 10; // Plus incertain
        break;
    }

    return Math.max(0, Math.min(100, score));
  }

  private static async analyzeDocumentQuality(contract: Contract, template: ContractTemplate): Promise<number> {
    let score = 90; // Score de base élevé

    // Vérifier la complétude des informations
    const variableCount = Object.keys(contract.variables).length;
    const templateVariableCount = template.variables.length;

    if (variableCount < templateVariableCount * 0.8) {
      score -= 15; // Moins de 80% des variables remplies
    } else if (variableCount < templateVariableCount) {
      score -= 5; // Variables manquantes
    }

    // Vérifier la qualité des données
    let emptyValues = 0;
    Object.values(contract.variables).forEach(value => {
      if (value === '' || value === null || value === undefined) {
        emptyValues++;
      }
    });

    score -= emptyValues * 3; // -3 points par valeur vide

    // Vérifier la présence de métadonnées
    if (!contract.metadata || Object.keys(contract.metadata).length === 0) {
      score -= 5;
    }

    // Vérifier la structure du template
    if (!template.template || template.template.length < 100) {
      score -= 10; // Template trop court
    }

    // Bonus pour les contrats avec analyse IA
    if (contract.aiAnalysis) {
      score += 5;
    }

    return Math.max(0, Math.min(100, score));
  }

  private static calculateRiskScore(financialRisk: number, legalCompliance: number, marketPosition: number): number {
    // Pondération des différents facteurs de risque
    const weights = {
      financial: 0.4,
      legal: 0.4,
      market: 0.2
    };

    const weightedScore =
      (financialRisk * weights.financial) +
      (legalCompliance * weights.legal) +
      (marketPosition * weights.market);

    return Math.round(weightedScore);
  }

  private static calculateComplianceScore(legalCompliance: number, documentQuality: number): number {
    // Pondération de la conformité et de la qualité
    const weights = {
      legal: 0.7,
      quality: 0.3
    };

    const weightedScore =
      (legalCompliance * weights.legal) +
      (documentQuality * weights.quality);

    return Math.round(weightedScore);
  }

  private static generateRecommendations(contract: Contract, analysis: any): string[] {
    const recommendations: string[] = [];

    // Recommandations basées sur le risque financier
    if (analysis.financialRisk < 70) {
      recommendations.push('Révision des conditions financières recommandée');
      if (contract.variables.depositAmount) {
        const deposit = Number(contract.variables.depositAmount);
        const rent = Number(contract.variables.monthlyRent);
        if (deposit < rent) {
          recommendations.push('Augmenter le dépôt de garantie');
        }
      }
    }

    // Recommandations basées sur la conformité légale
    if (analysis.legalCompliance < 80) {
      recommendations.push('Vérification légale approfondie nécessaire');
      recommendations.push('Ajouter les clauses légales manquantes');
    }

    // Recommandations basées sur la position marché
    if (analysis.marketPosition < 70) {
      recommendations.push('Ajustement des conditions selon le marché');
    }

    // Recommandations basées sur la qualité du document
    if (analysis.documentQuality < 80) {
      recommendations.push('Compléter les informations manquantes');
      recommendations.push('Révision du template recommandée');
    }

    // Recommandations spécifiques par type
    switch (contract.type) {
      case 'vacation_rental':
        recommendations.push('Vérifier la réglementation locale pour les locations saisonnières');
        break;
      case 'commercial_rental':
        recommendations.push('Ajouter des clauses commerciales spécifiques');
        break;
      case 'sublease':
        recommendations.push('Vérifier l\'autorisation du propriétaire principal');
        break;
    }

    // Si aucune recommandation spécifique, ajouter une recommandation générale
    if (recommendations.length === 0) {
      recommendations.push('Contrat conforme aux standards de qualité');
    }

    return recommendations.slice(0, 5); // Limiter à 5 recommandations
  }

  private static getMarketAnalysis(contract: Contract): string {
    const analyses = {
      rental: 'Marché locatif résidentiel stable',
      purchase: 'Marché immobilier en évolution',
      vacation_rental: 'Marché touristique saisonnier',
      lease: 'Marché commercial régional',
      sublease: 'Marché de sous-location spécialisé',
      commercial_rental: 'Marché commercial professionnel',
      reservation: 'Marché de réservation temporaire'
    };

    const baseAnalysis = analyses[contract.type] || 'Marché spécialisé';

    // Ajouter des détails basés sur les variables
    if (contract.variables.monthlyRent) {
      const rent = Number(contract.variables.monthlyRent);
      if (rent > 1500) {
        return `${baseAnalysis} - Segment premium`;
      } else if (rent < 800) {
        return `${baseAnalysis} - Segment accessible`;
      }
    }

    return baseAnalysis;
  }

  private static detectFlags(contract: Contract, analysis: any): string[] {
    const flags: string[] = [];

    // Flags critiques
    if (analysis.legalCompliance < 60) {
      flags.push('🚨 Conformité légale insuffisante');
    }

    if (analysis.financialRisk < 50) {
      flags.push('⚠️ Risque financier élevé');
    }

    // Flags de données
    if (!contract.parties || contract.parties.length < 2) {
      flags.push('❌ Parties du contrat incomplètes');
    }

    // Flags de cohérence
    if (contract.variables.startDate && contract.variables.endDate) {
      const start = new Date(contract.variables.startDate);
      const end = new Date(contract.variables.endDate);
      if (start >= end) {
        flags.push('📅 Dates incohérentes');
      }
    }

    return flags;
  }

  private static generateSuggestions(contract: Contract, template: ContractTemplate): string[] {
    const suggestions: string[] = [];

    // Suggestions d'amélioration
    const missingVariables = template.variables.filter(v =>
      !(v.key in contract.variables) ||
      contract.variables[v.key] === null ||
      contract.variables[v.key] === undefined
    );

    if (missingVariables.length > 0) {
      suggestions.push(`Compléter ${missingVariables.length} variable(s) manquante(s)`);
    }

    // Suggestions spécifiques
    if (contract.type === 'rental' && !contract.variables.furnished) {
      suggestions.push('Préciser si le logement est meublé');
    }

    if (!contract.metadata || Object.keys(contract.metadata).length === 0) {
      suggestions.push('Ajouter des métadonnées pour un meilleur suivi');
    }

    return suggestions;
  }
}

export default AIAnalysisService;