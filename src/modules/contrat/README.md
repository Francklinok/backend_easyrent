# Module Contrat - Backend EasyRent

Ce module implémente un système complet de gestion de contrats dynamiques avec génération automatique, signature électronique, et analyse IA.

## 📋 Fonctionnalités

### ✨ Fonctionnalités Principales

- **Contrats Dynamiques** : Support de différents types de contrats (location, achat, location saisonnière, etc.)
- **Templates Personnalisables** : Système de templates avec variables et clauses légales
- **Génération PDF** : Génération automatique de PDF avec QR codes et watermarks
- **Signature Électronique** : Système de signature multi-parties sécurisé
- **Analyse IA** : Évaluation automatique des risques et de la conformité
- **API GraphQL** : Interface complète pour toutes les opérations

### 🏗️ Types de Contrats Supportés

- `RENTAL` - Contrat de location résidentielle
- `PURCHASE` - Contrat de vente immobilière
- `VACATION_RENTAL` - Location saisonnière
- `LEASE` - Bail commercial
- `SUBLEASE` - Sous-location
- `COMMERCIAL_RENTAL` - Location commerciale
- `RESERVATION` - Contrat de réservation

## 🚀 Installation et Configuration

### Prérequis

```bash
npm install puppeteer qrcode mongoose apollo-server-express graphql-subscriptions
```

### Configuration de l'environnement

```env
# Variables d'environnement (.env)
FRONTEND_URL=https://your-app.com
MONGODB_URI=mongodb://localhost:27017/easyrent
UPLOAD_PATH=./uploads/contracts
```

### Intégration au serveur GraphQL

```typescript
// Dans src/graphql/index.ts
import { contractTypeDefs, contractResolvers } from '../modules/contrat';

const typeDefs = [
  // ... autres typeDefs
  contractTypeDefs
];

const resolvers = mergeResolvers([
  // ... autres resolvers
  contractResolvers
]);
```

## 📁 Structure du Module

```
src/modules/contrat/
├── models/              # Modèles Mongoose
│   ├── Contract.ts      # Modèle principal des contrats
│   ├── ContractParty.ts # Parties du contrat
│   └── ContractTemplate.ts # Templates de contrats
├── services/            # Services métier
│   └── ContractService.ts # Service principal
├── graphql/             # Schéma et resolvers GraphQL
│   ├── typeDefs.ts      # Définitions des types
│   └── resolvers.ts     # Resolvers GraphQL
├── utils/               # Utilitaires
│   ├── pdfGenerator.ts  # Génération PDF
│   ├── qrGenerator.ts   # Génération QR codes
│   ├── watermarkGenerator.ts # Watermarks
│   ├── validator.ts     # Validation
│   └── aiAnalysis.ts    # Analyse IA
├── types.ts             # Types TypeScript
├── index.ts             # Exports du module
└── README.md            # Documentation
```

## 💻 Utilisation

### Créer un Contrat

```graphql
mutation CreateContract($input: ContractGenerationInput!) {
  createContract(input: $input) {
    id
    type
    status
    generatedFileUri
    aiAnalysis {
      riskScore
      complianceScore
      recommendations
    }
  }
}
```

**Variables :**
```json
{
  "input": {
    "templateId": "rental_template",
    "type": "RENTAL",
    "propertyId": "property123",
    "parties": [
      { "role": "LANDLORD", "userId": "landlord123" },
      { "role": "TENANT", "userId": "tenant123" }
    ],
    "variables": {
      "monthlyRent": 1200,
      "depositAmount": 2400,
      "startDate": "2025-01-01",
      "endDate": "2026-01-01"
    },
    "autoGenerate": true
  }
}
```

### Signer un Contrat

```graphql
mutation SignContract($input: ContractSigningInput!) {
  signContract(input: $input) {
    id
    status
    signedAt
    parties {
      role
      signedAt
    }
  }
}
```

### Rechercher des Contrats

```graphql
query GetContracts($filters: ContractSearchFilters) {
  contracts(filters: $filters) {
    id
    type
    status
    createdAt
    parties {
      role
      user {
        fullName
      }
    }
    aiAnalysis {
      riskScore
      complianceScore
    }
  }
}
```

### Obtenir les Analytics

```graphql
query GetContractAnalytics($filters: ContractSearchFilters) {
  contractAnalytics(filters: $filters) {
    totalContracts
    contractsByType
    contractsByStatus
    complianceScore
    riskScore
    monthlyTrends {
      month
      count
      value
    }
  }
}
```

## 🔧 Configuration des Templates

### Créer un Template Personnalisé

```graphql
mutation CreateTemplate($input: ContractTemplateInput!) {
  createContractTemplate(input: $input) {
    id
    name
    type
    variables {
      key
      label
      type
      required
    }
  }
}
```

**Exemple de template :**
```json
{
  "input": {
    "type": "RENTAL",
    "name": "Contrat Location Standard",
    "description": "Template pour location résidentielle",
    "template": "<html>...</html>",
    "variables": [
      {
        "key": "monthlyRent",
        "label": "Loyer mensuel",
        "type": "CURRENCY",
        "required": true,
        "validation": { "min": 0, "max": 10000 }
      }
    ],
    "legalClauses": [
      {
        "id": "clause_1",
        "title": "Durée du bail",
        "content": "Le présent bail est conclu pour...",
        "isRequired": true,
        "order": 1
      }
    ]
  }
}
```

## 🎯 Analyse IA

Le système d'analyse IA évalue automatiquement :

- **Risque Financier** (0-100) : Analyse des montants et conditions
- **Conformité Légale** (0-100) : Vérification des clauses obligatoires
- **Position Marché** (0-100) : Évaluation par rapport au marché
- **Qualité Document** (0-100) : Complétude et cohérence

### Exemple de Résultat d'Analyse

```json
{
  "riskScore": 92,
  "complianceScore": 98,
  "marketAnalysis": "Marché locatif favorable",
  "recommendations": [
    "Excellent profil locataire",
    "Valeur immobilière en hausse",
    "Investissement à faible risque"
  ],
  "detailedAnalysis": {
    "financialRisk": 95,
    "legalCompliance": 98,
    "marketPosition": 88,
    "documentQuality": 92
  }
}
```

## 🔐 Sécurité

### Authentification et Autorisation

- Authentification requise pour toutes les opérations
- Autorisation basée sur les rôles (admin, propriétaire, locataire)
- Validation des permissions pour chaque contrat

### Génération Sécurisée

- QR codes avec données de vérification
- Watermarks anti-contrefaçon
- Horodatage et traçabilité complète

### Validation des Données

- Validation stricte des variables selon leur type
- Vérification de cohérence des données
- Détection automatique d'anomalies

## 📊 Monitoring et Analytics

### Métriques Disponibles

- Nombre total de contrats
- Répartition par type et statut
- Scores moyens de conformité et risque
- Tendances mensuelles

### Subscriptions GraphQL

- Notifications de changement de statut
- Alertes de signature
- Nouveaux contrats créés

## 🛠️ Développement

### Ajouter un Nouveau Type de Contrat

1. **Ajouter le type dans `types.ts`**
```typescript
export enum ContractType {
  // ... types existants
  NEW_TYPE = 'new_type'
}
```

2. **Créer le template par défaut**
```typescript
// Dans ContractService.initializeDefaultTemplates()
{
  id: 'new_type_template',
  type: ContractType.NEW_TYPE,
  name: 'Nouveau Type de Contrat',
  // ...
}
```

3. **Ajouter la validation spécifique**
```typescript
// Dans utils/validator.ts
case ContractType.NEW_TYPE:
  // Validations spécifiques
  break;
```

### Tests

```bash
# Lancer les tests
npm test

# Tests d'intégration
npm run test:integration

# Coverage
npm run test:coverage
```

## 📝 Migration des Données

Pour migrer depuis l'ancien système :

```bash
# Script de migration (à créer)
node scripts/migrate-contracts.js
```

## 🐛 Dépannage

### Erreurs Communes

- **PDF Generation Error** : Vérifier Puppeteer et les dépendances
- **Template not found** : Vérifier l'ID du template et son statut actif
- **Validation Error** : Vérifier la conformité des variables avec le template

### Logs

Les logs détaillés sont disponibles dans :
- Console du serveur
- Fichiers de logs (si configurés)
- Monitoring GraphQL

## 🔄 Roadmap

### Fonctionnalités Prévues

- [ ] Signature électronique avancée (certificats)
- [ ] Templates visuels (éditeur WYSIWYG)
- [ ] Intégration blockchain pour la vérification
- [ ] API REST complémentaire
- [ ] Export vers d'autres formats (Word, etc.)
- [ ] Notifications automatiques (email, SMS)

### Améliorations Techniques

- [ ] Cache Redis pour les performances
- [ ] Microservices pour la scalabilité
- [ ] Tests automatisés plus complets
- [ ] Monitoring avancé (Prometheus/Grafana)

## 📞 Support

Pour toute question ou problème :

1. Consulter cette documentation
2. Vérifier les logs d'erreur
3. Contacter l'équipe de développement

---

**Version:** 1.0.0
**Dernière mise à jour:** Septembre 2025