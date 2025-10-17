import { ContractVariable } from '../types';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateContractVariables(
  templateVariables: ContractVariable[],
  providedVariables: Record<string, any>
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Vérifier les variables requises
  const requiredVariables = templateVariables.filter(v => v.required);
  for (const variable of requiredVariables) {
    if (!(variable.key in providedVariables) ||
        providedVariables[variable.key] === null ||
        providedVariables[variable.key] === undefined ||
        providedVariables[variable.key] === '') {
      errors.push(`Variable requise manquante: ${variable.label} (${variable.key})`);
    }
  }

  // Valider chaque variable fournie
  for (const [key, value] of Object.entries(providedVariables)) {
    const templateVar = templateVariables.find(v => v.key === key);

    if (!templateVar) {
      warnings.push(`Variable non définie dans le template: ${key}`);
      continue;
    }

    const validationResult = validateVariable(templateVar, value);
    if (!validationResult.isValid) {
      errors.push(...validationResult.errors);
    }
    if (validationResult.warnings.length > 0) {
      warnings.push(...validationResult.warnings);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

export function validateVariable(
  variable: ContractVariable,
  value: any
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (value === null || value === undefined) {
    if (variable.required) {
      errors.push(`${variable.label} est requis`);
    }
    return { isValid: errors.length === 0, errors, warnings };
  }

  // Validation selon le type
  switch (variable.type) {
    case 'text':
      validateTextVariable(variable, value, errors, warnings);
      break;
    case 'number':
      validateNumberVariable(variable, value, errors, warnings);
      break;
    case 'currency':
      validateCurrencyVariable(variable, value, errors, warnings);
      break;
    case 'date':
      validateDateVariable(variable, value, errors, warnings);
      break;
    case 'boolean':
      validateBooleanVariable(variable, value, errors, warnings);
      break;
    case 'email':
      validateEmailVariable(variable, value, errors, warnings);
      break;
    case 'phone':
      validatePhoneVariable(variable, value, errors, warnings);
      break;
    default:
      warnings.push(`Type de variable non reconnu: ${variable.type}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

function validateTextVariable(
  variable: ContractVariable,
  value: any,
  errors: string[],
  warnings: string[]
): void {
  if (typeof value !== 'string') {
    errors.push(`${variable.label} doit être une chaîne de caractères`);
    return;
  }

  const validation = variable.validation;
  if (validation) {
    if (validation.min && value.length < validation.min) {
      errors.push(`${variable.label} doit contenir au moins ${validation.min} caractères`);
    }
    if (validation.max && value.length > validation.max) {
      errors.push(`${variable.label} ne peut pas dépasser ${validation.max} caractères`);
    }
    if (validation.pattern) {
      const regex = new RegExp(validation.pattern);
      if (!regex.test(value)) {
        errors.push(`${variable.label} ne respecte pas le format requis`);
      }
    }
    if (validation.options && !validation.options.includes(value)) {
      errors.push(`${variable.label} doit être l'une des valeurs: ${validation.options.join(', ')}`);
    }
  }
}

function validateNumberVariable(
  variable: ContractVariable,
  value: any,
  errors: string[],
  warnings: string[]
): void {
  const numValue = Number(value);
  if (isNaN(numValue)) {
    errors.push(`${variable.label} doit être un nombre valide`);
    return;
  }

  const validation = variable.validation;
  if (validation) {
    if (validation.min !== undefined && numValue < validation.min) {
      errors.push(`${variable.label} doit être supérieur ou égal à ${validation.min}`);
    }
    if (validation.max !== undefined && numValue > validation.max) {
      errors.push(`${variable.label} doit être inférieur ou égal à ${validation.max}`);
    }
  }
}

function validateCurrencyVariable(
  variable: ContractVariable,
  value: any,
  errors: string[],
  warnings: string[]
): void {
  const numValue = Number(value);
  if (isNaN(numValue)) {
    errors.push(`${variable.label} doit être un montant valide`);
    return;
  }

  if (numValue < 0) {
    errors.push(`${variable.label} ne peut pas être négatif`);
  }

  const validation = variable.validation;
  if (validation) {
    if (validation.min !== undefined && numValue < validation.min) {
      errors.push(`${variable.label} doit être supérieur ou égal à ${validation.min}€`);
    }
    if (validation.max !== undefined && numValue > validation.max) {
      errors.push(`${variable.label} doit être inférieur ou égal à ${validation.max}€`);
    }
  }

  // Avertissements pour des montants suspects
  if (numValue > 10000) {
    warnings.push(`${variable.label} semble élevé (${numValue}€)`);
  }
}

function validateDateVariable(
  variable: ContractVariable,
  value: any,
  errors: string[],
  warnings: string[]
): void {
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    errors.push(`${variable.label} doit être une date valide`);
    return;
  }

  const validation = variable.validation;
  if (validation) {
    if (validation.min) {
      const minDate = new Date(validation.min);
      if (date < minDate) {
        errors.push(`${variable.label} doit être postérieure au ${minDate.toLocaleDateString('fr-FR')}`);
      }
    }
    if (validation.max) {
      const maxDate = new Date(validation.max);
      if (date > maxDate) {
        errors.push(`${variable.label} doit être antérieure au ${maxDate.toLocaleDateString('fr-FR')}`);
      }
    }
  }

  // Vérifications logiques
  const now = new Date();
  const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  const tenYearsFromNow = new Date(now.getFullYear() + 10, now.getMonth(), now.getDate());

  if (date < oneYearAgo) {
    warnings.push(`${variable.label} semble très ancienne`);
  }
  if (date > tenYearsFromNow) {
    warnings.push(`${variable.label} semble très lointaine`);
  }
}

function validateBooleanVariable(
  variable: ContractVariable,
  value: any,
  errors: string[],
  warnings: string[]
): void {
  if (typeof value !== 'boolean' && value !== 'true' && value !== 'false' && value !== 0 && value !== 1) {
    errors.push(`${variable.label} doit être vrai ou faux`);
  }
}

function validateEmailVariable(
  variable: ContractVariable,
  value: any,
  errors: string[],
  warnings: string[]
): void {
  if (typeof value !== 'string') {
    errors.push(`${variable.label} doit être une chaîne de caractères`);
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value)) {
    errors.push(`${variable.label} doit être une adresse email valide`);
  }

  // Vérifications supplémentaires
  if (value.length > 254) {
    errors.push(`${variable.label} est trop long`);
  }

  const localPart = value.split('@')[0];
  if (localPart && localPart.length > 64) {
    warnings.push(`La partie locale de ${variable.label} est inhabituelle`);
  }
}

function validatePhoneVariable(
  variable: ContractVariable,
  value: any,
  errors: string[],
  warnings: string[]
): void {
  if (typeof value !== 'string') {
    errors.push(`${variable.label} doit être une chaîne de caractères`);
    return;
  }

  // Supprimer les espaces, tirets, points et parenthèses
  const cleanPhone = value.replace(/[\s\-\.\(\)]/g, '');

  // Vérifier les formats français
  const frenchMobileRegex = /^(\+33|0)[67]\d{8}$/;
  const frenchLandlineRegex = /^(\+33|0)[1-5]\d{8}$/;
  const internationalRegex = /^\+\d{8,15}$/;

  if (!frenchMobileRegex.test(cleanPhone) &&
      !frenchLandlineRegex.test(cleanPhone) &&
      !internationalRegex.test(cleanPhone)) {
    errors.push(`${variable.label} doit être un numéro de téléphone valide`);
  }

  if (cleanPhone.length < 8 || cleanPhone.length > 15) {
    errors.push(`${variable.label} a une longueur incorrecte`);
  }
}

export function validateContractCompleteness(contract: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Vérifications essentielles
  if (!contract.id) {
    errors.push('ID du contrat manquant');
  }

  if (!contract.templateId) {
    errors.push('Template du contrat manquant');
  }

  if (!contract.type) {
    errors.push('Type de contrat manquant');
  }

  if (!contract.parties || contract.parties.length === 0) {
    errors.push('Aucune partie définie dans le contrat');
  } else {
    // Vérifier que chaque partie a les informations requises
    contract.parties.forEach((party: any, index: number) => {
      if (!party.role) {
        errors.push(`Rôle manquant pour la partie ${index + 1}`);
      }
      if (!party.userId) {
        errors.push(`ID utilisateur manquant pour la partie ${index + 1}`);
      }
    });
  }

  if (!contract.variables || Object.keys(contract.variables).length === 0) {
    warnings.push('Aucune variable définie dans le contrat');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

export function validateContractConsistency(contract: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Vérifier la cohérence des dates
  if (contract.variables.startDate && contract.variables.endDate) {
    const startDate = new Date(contract.variables.startDate);
    const endDate = new Date(contract.variables.endDate);

    if (startDate >= endDate) {
      errors.push('La date de fin doit être postérieure à la date de début');
    }

    const duration = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    if (duration > 365 * 10) { // Plus de 10 ans
      warnings.push('La durée du contrat semble très longue');
    }
    if (duration < 1) { // Moins d\'un jour
      warnings.push('La durée du contrat semble très courte');
    }
  }

  // Vérifier la cohérence des montants
  if (contract.variables.monthlyRent && contract.variables.depositAmount) {
    const rent = Number(contract.variables.monthlyRent);
    const deposit = Number(contract.variables.depositAmount);

    if (deposit > rent * 3) {
      warnings.push('Le dépôt de garantie semble élevé par rapport au loyer');
    }
    if (deposit < rent * 0.5) {
      warnings.push('Le dépôt de garantie semble faible par rapport au loyer');
    }
  }

  // Vérifier les rôles des parties selon le type de contrat
  if (contract.type === 'rental') {
    const hasLandlord = contract.parties?.some((p: any) => p.role === 'landlord');
    const hasTenant = contract.parties?.some((p: any) => p.role === 'tenant');

    if (!hasLandlord) {
      errors.push('Un contrat de location doit avoir un propriétaire (landlord)');
    }
    if (!hasTenant) {
      errors.push('Un contrat de location doit avoir un locataire (tenant)');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

export default {
  validateContractVariables,
  validateVariable,
  validateContractCompleteness,
  validateContractConsistency
};