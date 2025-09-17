# Dépendances GraphQL Requises

Pour que l'implémentation GraphQL fonctionne, vous devez installer les packages suivants :

## Installation des dépendances

```bash
npm install apollo-server-express graphql @graphql-tools/schema @graphql-tools/merge graphql-shield rate-limiter-flexible
```

## Dépendances principales

### Core GraphQL
- `apollo-server-express`: Serveur GraphQL intégré à Express
- `graphql`: Implémentation JavaScript de GraphQL
- `@graphql-tools/schema`: Outils pour créer des schémas GraphQL
- `@graphql-tools/merge`: Fusion de resolvers et schémas

### Sécurité et Performance  
- `graphql-shield`: Système de permissions et sécurité
- `rate-limiter-flexible`: Rate limiting avancé

## Dépendances de développement (optionnelles)

```bash
npm install --save-dev @types/graphql graphql-tag
```

## Configuration TypeScript

Ajoutez dans votre `tsconfig.json` :

```json
{
  "compilerOptions": {
    "types": ["graphql"]
  }
}
```

## Variables d'environnement

Ajoutez dans votre `.env` :

```env
# GraphQL Configuration
GRAPHQL_ENDPOINT=/graphql
GRAPHQL_PLAYGROUND=true
GRAPHQL_INTROSPECTION=true

# CORS pour GraphQL
CORS_ORIGIN=http://localhost:3000,http://localhost:3001

# Rate Limiting
GRAPHQL_QUERY_LIMIT=100
GRAPHQL_MUTATION_LIMIT=20
GRAPHQL_SUBSCRIPTION_LIMIT=5
```

## Vérification de l'installation

Après installation, votre serveur GraphQL sera disponible à :
- **Playground**: `http://localhost:PORT/graphql` (développement)
- **API**: `http://localhost:PORT/graphql` (production)

## Test de fonctionnement

Requête de test simple :

```graphql
query TestQuery {
  me {
    id
    fullName
    email
  }
}
```

Cette requête devrait retourner les informations de l'utilisateur authentifié.