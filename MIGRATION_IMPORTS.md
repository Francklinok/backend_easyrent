# 📝 Liste des Fichiers à Mettre à Jour - Migration des Notifications

## ⚠️ Fichiers Nécessitant des Modifications

### Groupe 1: Imports depuis `notifications/` (pluriel) → `notification/`

#### 1. **src/crypto/services/CryptoMarketplaceService.ts**
```typescript
// ❌ AVANT
import { NotificationService } from '../../notifications/services/NotificationService';

// ✅ APRÈS
import { IntegratedNotificationService } from '../../notification';
// OU si vous voulez juste l'email/push
import { UnifiedNotificationService } from '../../notification';
```

#### 2. **src/crypto/services/CryptoPaymentService.ts**
```typescript
// ❌ AVANT
import { NotificationService } from '../../notifications/services/NotificationService';

// ✅ APRÈS
import { UnifiedNotificationService } from '../../notification';
```

#### 3. **src/crypto/services/DeFiService.ts**
```typescript
// ❌ AVANT
import { NotificationService } from '../../notifications/services/NotificationService';

// ✅ APRÈS
import { UnifiedNotificationService } from '../../notification';
```

#### 4. **src/crypto/services/PriceOracleService.ts**
```typescript
// ❌ AVANT
import { NotificationService } from '../../notifications/services/NotificationService';

// ✅ APRÈS
import { UnifiedNotificationService } from '../../notification';
```

#### 5. **src/crypto/services/PropertyTokenizationService.ts**
```typescript
// ❌ AVANT
import { NotificationService } from '../../notifications/services/NotificationService';

// ✅ APRÈS
import { UnifiedNotificationService } from '../../notification';
```

#### 6. **src/crypto/services/SmartContractService.ts**
```typescript
// ❌ AVANT
import { NotificationService } from '../../notifications/services/NotificationService';

// ✅ APRÈS
import { UnifiedNotificationService } from '../../notification';
```

#### 7. **src/crypto/services/UtilityTokenService.ts**
```typescript
// ❌ AVANT
import { NotificationService } from '../../notifications/services/NotificationService';

// ✅ APRÈS
import { UnifiedNotificationService } from '../../notification';
```

#### 8. **src/wallet/graphql/walletResolvers.ts**
```typescript
// ❌ AVANT
import { Notification } from '../../notifications/models/Notification';
import { NotificationPreference } from '../../notifications/models/NotificationPreference';
import { NotificationService } from '../../notifications/services/NotificationService';
import { InAppNotificationService } from '../../notifications/services/InAppNotificationService';

// ✅ APRÈS
import {
  Notification,
  NotificationPreference,
  UnifiedNotificationService,
  InAppNotificationService
} from '../../notification';
```

---

### Groupe 2: Imports depuis `services/notificationServices` → `notification/`

#### 9. **src/auth/controllers/authControllers.ts**
```typescript
// ❌ AVANT
import { NotificationService } from '../../services/notificationServices';

// ✅ APRÈS
import { UnifiedNotificationService } from '../../notification';

// ET dans le code, remplacer:
// const notificationService = new NotificationService();
// PAR:
const notificationService = new UnifiedNotificationService();
```

#### 10. **src/users/controllers/userController.ts**
```typescript
// ❌ AVANT
import { NotificationService } from '../../services/notificationServices';

// ✅ APRÈS
import { UnifiedNotificationService } from '../../notification';

// ET renommer dans le code
```

#### 11. **src/users/services/userService.ts**
```typescript
// ❌ AVANT
import { NotificationService } from "../../services/notificationServices";

// ✅ APRÈS
import { UnifiedNotificationService } from "../../notification";

// ET renommer dans le code
```

#### 12. **src/wallet/services/UnifiedPaymentService.ts**
```typescript
// ❌ AVANT
import { NotificationService } from '../../services/notificationServices';

// ✅ APRÈS
import { UnifiedNotificationService } from '../../notification';

// ET renommer dans le code
```

---

## 🔧 Script de Remplacement Automatique (Optionnel)

Vous pouvez utiliser ce script bash pour automatiser les remplacements :

```bash
#!/bin/bash

# Script de migration automatique des imports de notifications

# Groupe 1: notifications/ → notification/
files_group1=(
  "src/crypto/services/CryptoMarketplaceService.ts"
  "src/crypto/services/CryptoPaymentService.ts"
  "src/crypto/services/DeFiService.ts"
  "src/crypto/services/PriceOracleService.ts"
  "src/crypto/services/PropertyTokenizationService.ts"
  "src/crypto/services/SmartContractService.ts"
  "src/crypto/services/UtilityTokenService.ts"
)

for file in "${files_group1[@]}"; do
  echo "Updating: $file"
  sed -i "s|from '../../notifications/services/NotificationService'|from '../../notification'|g" "$file"
  sed -i "s|NotificationService|UnifiedNotificationService|g" "$file"
done

# Groupe 2: services/notificationServices → notification/
files_group2=(
  "src/auth/controllers/authControllers.ts"
  "src/users/controllers/userController.ts"
  "src/users/services/userService.ts"
  "src/wallet/services/UnifiedPaymentService.ts"
)

for file in "${files_group2[@]}"; do
  echo "Updating: $file"
  sed -i "s|from '../../services/notificationServices'|from '../../notification'|g" "$file"
  sed -i "s|from \"../../services/notificationServices\"|from \"../../notification\"|g" "$file"
  sed -i "s|NotificationService|UnifiedNotificationService|g" "$file"
done

# walletResolvers.ts (cas spécial avec plusieurs imports)
echo "Updating: src/wallet/graphql/walletResolvers.ts"
sed -i "s|from '../../notifications/models/Notification'|from '../../notification'|g" "src/wallet/graphql/walletResolvers.ts"
sed -i "s|from '../../notifications/models/NotificationPreference'|from '../../notification'|g" "src/wallet/graphql/walletResolvers.ts"
sed -i "s|from '../../notifications/services/NotificationService'|from '../../notification'|g" "src/wallet/graphql/walletResolvers.ts"
sed -i "s|from '../../notifications/services/InAppNotificationService'|from '../../notification'|g" "src/wallet/graphql/walletResolvers.ts"
sed -i "s|NotificationService|UnifiedNotificationService|g" "src/wallet/graphql/walletResolvers.ts"

echo "✅ Migration automatique terminée!"
echo "⚠️  Vérifiez manuellement les modifications avant de commit"
```

**Pour exécuter le script:**
```bash
chmod +x migrate-notifications.sh
./migrate-notifications.sh
```

---

## ✅ Checklist de Vérification

Après avoir modifié tous les fichiers, vérifiez :

- [ ] **Tous les imports sont mis à jour**
  ```bash
  # Vérifier qu'il ne reste plus d'imports de l'ancien dossier
  grep -r "from.*notifications/" src/ --include="*.ts"
  # Devrait retourner uniquement des commentaires ou rien
  ```

- [ ] **Les instances sont renommées**
  ```bash
  # Vérifier que NotificationService est bien renommé en UnifiedNotificationService
  grep -r "new NotificationService()" src/ --include="*.ts"
  # Devrait retourner vide (sauf dans le fichier notificationServices.ts lui-même)
  ```

- [ ] **Le projet compile**
  ```bash
  npx tsc --noEmit
  # Devrait compiler sans erreurs
  ```

- [ ] **Les tests passent** (si vous en avez)
  ```bash
  npm test
  ```

---

## 📊 Résumé des Modifications

| Fichier | Ancien Import | Nouveau Import | Renommage |
|---------|--------------|----------------|-----------|
| crypto/services/*.ts (x7) | `../../notifications/services/NotificationService` | `../../notification` | `NotificationService` → `UnifiedNotificationService` |
| wallet/graphql/walletResolvers.ts | `../../notifications/...` | `../../notification` | Multiple |
| auth/controllers/authControllers.ts | `../../services/notificationServices` | `../../notification` | `NotificationService` → `UnifiedNotificationService` |
| users/controllers/userController.ts | `../../services/notificationServices` | `../../notification` | `NotificationService` → `UnifiedNotificationService` |
| users/services/userService.ts | `../../services/notificationServices` | `../../notification` | `NotificationService` → `UnifiedNotificationService` |
| wallet/services/UnifiedPaymentService.ts | `../../services/notificationServices` | `../../notification` | `NotificationService` → `UnifiedNotificationService` |

**Total: 12 fichiers à mettre à jour**

---

## 🚨 Attention Particulière

### Fichier `src/wallet/graphql/walletResolvers.ts`

Ce fichier a **4 imports différents** à remplacer. Assurez-vous de tous les mettre à jour :

```typescript
// ❌ AVANT (4 lignes différentes)
import { Notification } from '../../notifications/models/Notification';
import { NotificationPreference } from '../../notifications/models/NotificationPreference';
import { NotificationService } from '../../notifications/services/NotificationService';
import { InAppNotificationService } from '../../notifications/services/InAppNotificationService';

// ✅ APRÈS (1 seule ligne)
import {
  Notification,
  NotificationPreference,
  UnifiedNotificationService,
  InAppNotificationService
} from '../../notification';

// ET dans le code, remplacer toutes les instances de:
// new NotificationService() → new UnifiedNotificationService()
```

---

## 🎯 Prochaines Étapes

1. ✅ **Faire les modifications** (manuellement ou avec le script)
2. ✅ **Vérifier la compilation** : `npx tsc --noEmit`
3. ✅ **Tester l'application**
4. ✅ **Supprimer l'ancien dossier** : `rm -rf src/notifications/`
5. ✅ **Commit** : `git add . && git commit -m "refactor: migrate all imports to consolidated notification system"`

---

**Date de création**: 2025-01-10
**Nombre de fichiers à modifier**: 12
**Estimation temps**: 15-30 minutes
