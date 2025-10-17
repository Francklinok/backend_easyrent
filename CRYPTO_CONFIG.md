# Configuration des Fonctionnalités Crypto - EasyRent Backend

## Vue d'ensemble

Le backend EasyRent inclut des fonctionnalités de cryptomonnaies optionnelles qui peuvent être activées ou désactivées selon vos besoins. Cette documentation explique comment configurer et gérer ces fonctionnalités.

## 🔧 Configuration

### Variables d'environnement

Ajoutez les variables suivantes à votre fichier `.env` :

```bash
# Activation/désactivation des fonctionnalités crypto
CRYPTO_ENABLED=false                                    # true pour activer, false pour désactiver

# Configuration des devises supportées
CRYPTO_SUPPORTED_CURRENCIES=BTC,ETH,LTC,BCH,XRP,ADA   # Devises séparées par virgules

# Configuration de l'API crypto
CRYPTO_API_URL=https://api.coingecko.com/api/v3        # URL de l'API pour les prix
CRYPTO_API_KEY=your_crypto_api_key_here                # Clé API (optionnel)

# Limites d'achat/vente
CRYPTO_MIN_BUY_AMOUNT=10                               # Montant minimum d'achat en EUR
CRYPTO_MAX_BUY_AMOUNT=10000                            # Montant maximum d'achat en EUR

# Frais de transaction
CRYPTO_TRANSACTION_FEE=1.5                             # Pourcentage de frais (1.5%)
```

## 🚀 Activation des fonctionnalités

### Étape 1: Activer dans l'environnement
```bash
CRYPTO_ENABLED=true
```

### Étape 2: Configurer les devises supportées
```bash
# Exemple pour Bitcoin, Ethereum et Litecoin uniquement
CRYPTO_SUPPORTED_CURRENCIES=BTC,ETH,LTC
```

### Étape 3: Définir les limites
```bash
CRYPTO_MIN_BUY_AMOUNT=50        # Minimum 50 EUR
CRYPTO_MAX_BUY_AMOUNT=5000      # Maximum 5000 EUR
CRYPTO_TRANSACTION_FEE=2.0      # Frais de 2%
```

### Étape 4: Redémarrer l'application
```bash
npm run dev
```

## ❌ Désactivation des fonctionnalités

Pour désactiver complètement les fonctionnalités crypto :

```bash
CRYPTO_ENABLED=false
```

Avec cette configuration :
- Toutes les requêtes GraphQL crypto retourneront une erreur
- Les utilisateurs ne pourront pas acheter/vendre de crypto
- L'interface ne devrait pas afficher les options crypto

## 📊 API GraphQL

### Vérifier la configuration actuelle

```graphql
query {
  cryptoConfig {
    enabled
    supportedCurrencies
    minimumBuyAmount
    maximumBuyAmount
    transactionFeePercentage
  }
}
```

### Obtenir les prix (si activé)

```graphql
query {
  cryptoPrices(currencies: [BTC, ETH]) {
    currency
    priceEUR
    priceUSD
    change24h
    lastUpdated
  }
}
```

### Acheter des cryptomonnaies (si activé)

```graphql
mutation {
  buyCrypto(input: {
    currency: BTC
    amount: 0.001
    paymentMethodId: "payment_method_id"
  }) {
    id
    amount
    currency
    description
    status
  }
}
```

## 🔒 Gestion des erreurs

Lorsque les fonctionnalités crypto sont désactivées, les erreurs suivantes peuvent survenir :

### Erreur de fonctionnalité désactivée
```json
{
  "errors": [
    {
      "message": "Crypto functionality is currently disabled",
      "extensions": {
        "code": "FEATURE_DISABLED"
      }
    }
  ]
}
```

### Erreur de devise non supportée
```json
{
  "errors": [
    {
      "message": "Currency XYZ is not supported. Supported currencies: BTC, ETH, LTC",
      "extensions": {
        "code": "UNSUPPORTED_CURRENCY"
      }
    }
  ]
}
```

### Erreur de montant
```json
{
  "errors": [
    {
      "message": "Minimum buy amount is 10 EUR",
      "extensions": {
        "code": "AMOUNT_TOO_LOW"
      }
    }
  ]
}
```

## 🛡️ Sécurité

### Bonnes pratiques

1. **En production** : Toujours utiliser HTTPS pour les API crypto
2. **Clés API** : Stocker les clés API dans des variables d'environnement sécurisées
3. **Limites** : Définir des limites d'achat appropriées pour votre cas d'usage
4. **Monitoring** : Surveiller les transactions crypto pour détecter les activités suspectes

### Logs et auditabilité

Toutes les transactions crypto sont automatiquement enregistrées avec :
- ID de l'utilisateur
- Montant et devise
- Timestamp
- Status de la transaction
- Frais appliqués

## 📈 Monitoring

### Métriques importantes à surveiller

1. **Volume de transactions crypto** par jour/semaine/mois
2. **Frais générés** par les transactions crypto
3. **Erreurs d'API** lors de la récupération des prix
4. **Temps de réponse** des opérations crypto

### Exemple de requête pour les statistiques

```graphql
query {
  walletStats(dateFrom: "2024-01-01", dateTo: "2024-12-31") {
    transactionsByType {
      type
      count
      volume
      percentage
    }
  }
}
```

## 🔄 Migration

### Activar les crypto sur une base existante

1. Ajouter les variables d'environnement
2. Redémarrer l'application
3. Les utilisateurs existants auront automatiquement accès aux fonctionnalités crypto
4. Les wallets existants supporteront les cryptomonnaies

### Désactiver les crypto temporairement

1. Changer `CRYPTO_ENABLED=false`
2. Redémarrer l'application
3. Les soldes crypto existants sont préservés
4. Les utilisateurs ne peuvent pas effectuer de nouvelles transactions crypto

## 🆘 Dépannage

### Problème : Les prix crypto ne se chargent pas

**Solution** :
1. Vérifier la connectivité internet
2. Vérifier l'URL de l'API crypto
3. Vérifier la clé API si requise
4. Consulter les logs pour les erreurs spécifiques

### Problème : Erreur lors de l'achat de crypto

**Causes possibles** :
1. Fonctionnalité désactivée (`CRYPTO_ENABLED=false`)
2. Devise non supportée
3. Montant en dehors des limites
4. Solde wallet insuffisant
5. Méthode de paiement invalide

### Problème : Performance lente des opérations crypto

**Solutions** :
1. Implémenter un cache pour les prix crypto
2. Utiliser des pools de connexions pour l'API
3. Optimiser les requêtes de base de données
4. Considérer un service de queue pour les transactions

## 📞 Support

Pour toute question concernant la configuration crypto :

1. Vérifier cette documentation
2. Consulter les logs de l'application
3. Vérifier la configuration dans `/graphql` avec la query `cryptoConfig`
4. Contacter l'équipe de développement avec les détails de l'erreur

---

**Note** : Cette fonctionnalité est conçue pour être complètement optionnelle. Votre application fonctionne parfaitement sans les crypto activées.