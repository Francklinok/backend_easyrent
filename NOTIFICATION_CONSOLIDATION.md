# 📧 Consolidation du Système de Notifications - Guide de Migration

## 🎯 Résumé

Le système de notifications a été consolidé pour éliminer les doublons et améliorer la maintenabilité. **Toute la fonctionnalité de notification est maintenant centralisée dans `src/notification/`** (singulier).

---

## 📊 Structure AVANT (Problème)

```
src/
├── notification/         # Dossier principal (le plus complet)
│   ├── models/
│   ├── services/
│   └── types/
├── notifications/        # Dossier en double (redondant)
│   ├── models/
│   ├── services/
│   └── config/
├── services/
│   └── notificationServices.ts  # Service technique réutilisé
└── type/
    └── notificationType.ts      # Types en double
```

**Problème**: 3 emplacements différents avec des implémentations qui se chevauchent !

---

## ✅ Structure APRÈS (Solution)

```
src/
└── notification/         # ✅ UNIQUE SOURCE DE VÉRITÉ
    ├── models/
    │   ├── Notification.ts        # Modèle principal
    │   ├── NotificationPreference.ts  # Préférences utilisateur
    │   └── index.ts
    ├── services/
    │   ├── NotificationManager.ts          # Orchestrateur multi-canaux
    │   ├── IntegratedNotificationService.ts # Service unifié (RECOMMANDÉ)
    │   ├── EmailNotificationService.ts
    │   ├── SmsNotificationService.ts
    │   ├── InAppNotificationService.ts
    │   ├── ActivityNotificationService.ts
    │   ├── PropertyNotificationService.ts
    │   ├── ChatNotificationService.ts
    │   └── index.ts
    ├── types/
    │   └── notificationTypes.ts
    └── index.ts         # Point d'entrée unique
```

---

## 🔄 Guide de Migration des Imports

### 1. Imports depuis `src/notifications/` (pluriel) → `src/notification/`

**AVANT:**
```typescript
import { NotificationService } from '@/notifications/services/NotificationService';
import { Notification } from '@/notifications/models/Notification';
import { NotificationPreference } from '@/notifications/models/NotificationPreference';
```

**APRÈS:**
```typescript
import { IntegratedNotificationService, Notification, NotificationPreference } from '@/notification';
// ou
import { UnifiedNotificationService } from '@/notification';
```

---

### 2. Imports depuis `src/services/notificationServices.ts`

**AVANT:**
```typescript
import { NotificationService } from '@/services/notificationServices';
const service = new NotificationService();
await service.sendVerificationEmail(email, firstName, code);
```

**APRÈS:**
```typescript
import { UnifiedNotificationService } from '@/notification';
const service = new UnifiedNotificationService();
await service.sendVerificationEmail(email, firstName, code);
```

---

### 3. Types de notifications

**AVANT:**
```typescript
import { NotificationChannel, NotificationType } from '@/notifications/models/Notification';
// ou
import { EmailOptions } from '@/services/notificationServices';
```

**APRÈS:**
```typescript
import {
  NotificationChannel,
  NotificationType,
  NotificationPriority,
  NotificationStatus,
  NotificationRequest
} from '@/notification';
```

---

## 🚀 Exemples d'Utilisation

### Exemple 1: Notification Complète (RECOMMANDÉ)

```typescript
import { IntegratedNotificationService } from '@/notification';
import { Server as SocketIOServer } from 'socket.io';

// Dans votre application
const io: SocketIOServer = /* votre instance socket.io */;
const notificationService = new IntegratedNotificationService(io);

// Envoyer une notification quand une nouvelle propriété est créée
await notificationService.onNewPropertyCreated(property);

// Notification pour une nouvelle visite
await notificationService.onVisitRequested(activity);

// Notification de paiement
await notificationService.onPaymentCompleted(activity);

// Notification custom
await notificationService.sendCustomNotification({
  userId: 'user123',
  type: NotificationType.CUSTOM,
  channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
  title: 'Nouveau message',
  message: 'Vous avez reçu un nouveau message',
  priority: NotificationPriority.HIGH
});
```

### Exemple 2: Notification Multi-Canaux

```typescript
import { NotificationManager, NotificationChannel, NotificationType, NotificationPriority } from '@/notification';

const manager = new NotificationManager(io);

await manager.sendNotification({
  userId: ['user1', 'user2'],  // Plusieurs utilisateurs
  type: NotificationType.PROPERTY_PUBLISHED,
  channels: [
    NotificationChannel.EMAIL,
    NotificationChannel.IN_APP,
    NotificationChannel.PUSH,
    NotificationChannel.SMS
  ],
  title: 'Nouvelle propriété disponible',
  message: 'Une nouvelle propriété correspond à vos critères',
  priority: NotificationPriority.NORMAL,
  data: {
    email: {
      to: ['user1@example.com', 'user2@example.com'],
      subject: 'Nouvelle propriété',
      htmlContent: '<h1>...</h1>'
    },
    inApp: {
      userId: ['user1', 'user2'],
      title: 'Nouvelle propriété',
      message: 'Découvrez cette nouvelle propriété',
      actionUrl: '/properties/123'
    },
    push: {
      tokens: ['fcm_token1', 'fcm_token2'],
      title: 'Nouvelle propriété',
      body: 'Découvrez cette nouvelle propriété'
    }
  }
});
```

### Exemple 3: Email Technique Direct

```typescript
import { UnifiedNotificationService } from '@/notification';

const emailService = new UnifiedNotificationService();

// Email de vérification
await emailService.sendVerificationEmail(
  'user@example.com',
  'John',
  '123456'
);

// Email de réinitialisation de mot de passe
await emailService.sendPasswordResetEmail(
  'user@example.com',
  'https://app.example.com/reset?token=xyz',
  'John'
);

// Email de bienvenue
await emailService.sendWelcomeEmail('user@example.com', 'John');

// Email custom
await emailService.sendemail({
  to: 'user@example.com',
  subject: 'Mon sujet',
  html: '<h1>Contenu HTML</h1>',
  text: 'Contenu texte'
});
```

### Exemple 4: Gestion des Préférences

```typescript
import { NotificationPreference } from '@/notification';

// Récupérer les préférences d'un utilisateur
const preferences = await NotificationPreference.findOne({ userId: 'user123' });

// Créer/Mettre à jour les préférences
await NotificationPreference.findOneAndUpdate(
  { userId: 'user123' },
  {
    preferences: {
      wallet: { inApp: true, push: true, email: true, sms: false },
      property: { inApp: true, push: true, email: true, sms: false },
      security: { inApp: true, push: true, email: true, sms: true }
    },
    quietHours: {
      enabled: true,
      startTime: '22:00',
      endTime: '08:00',
      timezone: 'Europe/Paris'
    }
  },
  { upsert: true, new: true }
);
```

---

## 🗑️ Fichiers et Dossiers à Supprimer

Une fois la migration terminée, **supprimer** les éléments suivants :

### ❌ Dossier complet à supprimer :
```bash
rm -rf src/notifications/  # Dossier pluriel complet
```

### ❌ Fichiers individuels à supprimer (si nécessaire) :
```
src/type/notificationType.ts          # Types en double
src/users/models/notificationSchema.ts # Si pas utilisé ailleurs
```

### ⚠️ À CONSERVER :
```
src/services/notificationServices.ts  # Service technique utilisé par EmailNotificationService
src/notification/                      # Dossier principal consolidé
```

---

## 🔍 Rechercher et Remplacer les Imports

### Méthode automatique (recommandée)

Utilisez ces commandes pour trouver tous les imports à mettre à jour :

```bash
# Trouver tous les imports depuis notifications/ (pluriel)
grep -r "from.*notifications/" src/ --include="*.ts" --include="*.tsx"

# Trouver tous les imports directs de notificationServices
grep -r "from.*services/notificationServices" src/ --include="*.ts" --include="*.tsx"

# Trouver tous les imports de notificationType
grep -r "from.*type/notificationType" src/ --include="*.ts" --include="*.tsx"
```

### Remplacement suggéré

| Pattern à chercher | Remplacement |
|-------------------|--------------|
| `from '@/notifications/services/NotificationService'` | `from '@/notification'` |
| `from '@/notifications/models/Notification'` | `from '@/notification'` |
| `from '@/services/notificationServices'` | `from '@/notification'` (+ renommer `NotificationService` → `UnifiedNotificationService`) |
| `from '@/type/notificationType'` | `from '@/notification'` |

---

## ✅ Checklist de Migration

- [ ] 1. **Mettre à jour les imports** dans tous les fichiers
  - [ ] Remplacer `@/notifications/` par `@/notification`
  - [ ] Remplacer `@/services/notificationServices` par `@/notification`
  - [ ] Renommer `NotificationService` → `UnifiedNotificationService` (si nécessaire)

- [ ] 2. **Tester les fonctionnalités**
  - [ ] Envoi d'emails (vérification, réinitialisation, etc.)
  - [ ] Notifications in-app
  - [ ] Notifications push
  - [ ] Notifications SMS
  - [ ] Préférences utilisateur

- [ ] 3. **Vérifier les builds**
  ```bash
  npm run build  # ou votre commande de build
  npx tsc --noEmit  # Vérifier les erreurs TypeScript
  ```

- [ ] 4. **Supprimer les anciens fichiers**
  ```bash
  rm -rf src/notifications/
  rm -f src/type/notificationType.ts
  ```

- [ ] 5. **Commit et push**
  ```bash
  git add .
  git commit -m "refactor: consolidate notification system into single directory"
  git push
  ```

---

## 📚 Documentation des Services

### `IntegratedNotificationService` (RECOMMANDÉ)
Service de haut niveau qui orchestre toutes les notifications métier.

**Cas d'usage:**
- Notifications de propriétés
- Notifications d'activités (visites, réservations)
- Notifications de chat
- Notifications de marketplace

### `NotificationManager`
Gestionnaire bas-niveau pour les notifications multi-canaux.

**Cas d'usage:**
- Envoi personnalisé multi-canaux
- Notifications planifiées
- Statistiques de notifications

### `UnifiedNotificationService`
Service technique pour les emails et push notifications.

**Cas d'usage:**
- Emails de vérification, mot de passe, etc.
- Push notifications Firebase/Web Push
- Files d'attente et retry automatique

---

## 🐛 Troubleshooting

### Erreur: "Cannot find module '@/notification'"

**Solution:** Vérifiez votre `tsconfig.json`:
```json
{
  "compilerOptions": {
    "baseUrl": "./",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

### Erreur: "NotificationService is not exported"

**Solution:** Utilisez `UnifiedNotificationService` au lieu de `NotificationService`:
```typescript
import { UnifiedNotificationService } from '@/notification';
```

### Erreur de types manquants

**Solution:** Importez les types depuis `@/notification`:
```typescript
import {
  NotificationType,
  NotificationChannel,
  NotificationPriority,
  NotificationRequest
} from '@/notification';
```

---

## 📞 Support

Si vous rencontrez des problèmes lors de la migration :
1. Vérifiez que tous les imports sont à jour
2. Exécutez `npx tsc --noEmit` pour voir les erreurs TypeScript
3. Consultez les exemples ci-dessus
4. Vérifiez que les anciens dossiers ont bien été supprimés

---

## 🎉 Avantages de la Consolidation

✅ **Un seul point d'entrée** : `import { ... } from '@/notification'`
✅ **Pas de doublons** : Une seule implémentation de chaque fonctionnalité
✅ **Meilleure maintenabilité** : Code centralisé et bien organisé
✅ **Documentation claire** : Exemples et types bien définis
✅ **Backward compatibility** : Les anciennes méthodes sont toujours accessibles

---

**Date de consolidation** : 2025-01-10
**Version** : 1.0.0
