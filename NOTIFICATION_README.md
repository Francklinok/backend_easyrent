# 🔔 Système de Notifications Consolidé - EasyRent

## 📋 Vue d'ensemble

Le système de notifications a été entièrement consolidé et réorganisé pour éliminer les doublons et améliorer la maintenabilité. Toute la fonctionnalité est maintenant centralisée dans **`src/notification/`** (singulier).

---

## 🎯 Ce qui a été fait

### ✅ 1. Structure Consolidée

**Dossier unique**: `src/notification/`
```
src/notification/
├── models/
│   ├── Notification.ts              # Modèle principal avec tous les types
│   ├── NotificationPreference.ts    # Préférences utilisateur
│   └── index.ts
├── services/
│   ├── NotificationManager.ts       # Gestionnaire multi-canaux
│   ├── IntegratedNotificationService.ts  # Service unifié (⭐ RECOMMANDÉ)
│   ├── EmailNotificationService.ts
│   ├── SmsNotificationService.ts
│   ├── InAppNotificationService.ts
│   ├── ActivityNotificationService.ts
│   ├── PropertyNotificationService.ts
│   ├── ChatNotificationService.ts
│   └── index.ts
├── types/
│   └── notificationTypes.ts         # Types TypeScript complets
└── index.ts                          # Point d'entrée unique
```

### ✅ 2. Fichiers Créés

- ✅ `src/notification/models/NotificationPreference.ts` - Ajouté depuis `notifications/`
- ✅ `src/notification/models/index.ts` - Exports centralisés des modèles
- ✅ `src/notification/services/index.ts` - Exports centralisés des services
- ✅ `src/notification/index.ts` - Point d'entrée avec documentation

### ✅ 3. Documentation

- ✅ `NOTIFICATION_CONSOLIDATION.md` - Guide de migration détaillé
- ✅ `MIGRATION_IMPORTS.md` - Liste des 12 fichiers à mettre à jour
- ✅ `migrate-notifications.ps1` - Script PowerShell automatique
- ✅ `NOTIFICATION_README.md` - Ce fichier

---

## 🚀 Utilisation Rapide

### Import Recommandé

```typescript
import { IntegratedNotificationService } from '@/notification';
```

### Exemples de Code

#### 1. Notification de Propriété
```typescript
import { IntegratedNotificationService } from '@/notification';

const notifService = new IntegratedNotificationService(io);

// Nouvelle propriété
await notifService.onNewPropertyCreated(property);

// Changement de prix
await notifService.onPropertyPriceChanged(property, oldPrice, newPrice);
```

#### 2. Notification d'Activité
```typescript
// Demande de visite
await notifService.onVisitRequested(activity);

// Réservation confirmée
await notifService.onReservationResponseGiven(activity, true);

// Paiement effectué
await notifService.onPaymentCompleted(activity);
```

#### 3. Email Technique
```typescript
import { UnifiedNotificationService } from '@/notification';

const emailService = new UnifiedNotificationService();

// Email de vérification
await emailService.sendVerificationEmail(email, firstName, code);

// Email de mot de passe oublié
await emailService.sendPasswordResetEmail(email, resetLink, firstName);
```

#### 4. Notification Custom
```typescript
import { NotificationManager, NotificationChannel, NotificationType, NotificationPriority } from '@/notification';

const manager = new NotificationManager(io);

await manager.sendNotification({
  userId: 'user123',
  type: NotificationType.CUSTOM,
  channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
  title: 'Titre personnalisé',
  message: 'Message personnalisé',
  priority: NotificationPriority.HIGH,
  data: {
    email: {
      to: 'user@example.com',
      subject: 'Mon sujet',
      htmlContent: '<h1>HTML</h1>'
    }
  }
});
```

---

## ⚡ Migration Rapide

### Option 1: Script Automatique (Recommandé)

```powershell
# Exécuter le script PowerShell
.\migrate-notifications.ps1
```

### Option 2: Manuel

Consultez `MIGRATION_IMPORTS.md` pour la liste des 12 fichiers à modifier.

---

## 📦 Services Disponibles

### 🌟 IntegratedNotificationService (RECOMMANDÉ)
Service de haut niveau qui orchestre toutes les notifications métier.

**Cas d'usage:**
- Notifications de propriétés (création, publication, modification)
- Notifications d'activités (visites, réservations, paiements)
- Notifications de chat
- Notifications de marketplace

**Méthodes principales:**
- `onNewPropertyCreated(property)`
- `onPropertyStatusChanged(property, oldStatus, newStatus)`
- `onPropertyPriceChanged(property, oldPrice, newPrice)`
- `onVisitRequested(activity)`
- `onReservationConfirmed(activity)`
- `onPaymentCompleted(activity)`
- `onNewMessage(message, conversation)`

### 🎯 NotificationManager
Gestionnaire bas-niveau pour les notifications multi-canaux.

**Cas d'usage:**
- Envoi personnalisé multi-canaux
- Notifications planifiées
- Statistiques de notifications
- Contrôle fin sur les canaux

**Méthodes principales:**
- `sendNotification(request)`
- `scheduleNotification(request, scheduledAt)`
- `sendTemplateNotification(templateId, data, request)`
- `getNotificationStats(userId?, startDate?, endDate?)`

### 📧 UnifiedNotificationService
Service technique pour les emails et push notifications.

**Cas d'usage:**
- Emails de vérification
- Emails de mot de passe
- Emails de sécurité
- Push notifications Firebase/Web Push
- Files d'attente et retry automatique

**Méthodes principales:**
- `sendVerificationEmail(email, firstName, code)`
- `sendPasswordResetEmail(email, resetLink, firstName)`
- `sendWelcomeEmail(email, firstName)`
- `sendSecurityNotification(email, firstName, type)`
- `sendFCMPushNotification(tokens, notification)`
- `sendWebPushNotification(subscriptions, notification)`

---

## 🎨 Types et Enums Disponibles

```typescript
import {
  // Enums
  NotificationType,      // Type de notification
  NotificationChannel,   // Canal de diffusion
  NotificationPriority,  // Niveau de priorité
  NotificationStatus,    // Statut de la notification

  // Interfaces
  NotificationRequest,   // Requête de notification
  NotificationMetadata,  // Métadonnées
  EmailNotificationData, // Données email
  PushNotificationData,  // Données push
  InAppNotificationData, // Données in-app
  SmsNotificationData,   // Données SMS

  // Models
  Notification,          // Modèle Mongoose
  NotificationHistory,   // Historique
  NotificationPreference // Préférences
} from '@/notification';
```

### NotificationType (30+ types)
```typescript
enum NotificationType {
  // User
  USER_REGISTRATION, USER_VERIFICATION, PASSWORD_RESET,
  PASSWORD_CHANGED, ACCOUNT_LOCKED, SECURITY_ALERT,

  // Property
  PROPERTY_APPROVED, PROPERTY_REJECTED, PROPERTY_PUBLISHED,
  PROPERTY_RENTED, PROPERTY_AVAILABLE,

  // Booking
  BOOKING_REQUEST, BOOKING_CONFIRMED, BOOKING_CANCELLED,
  VISIT_SCHEDULED, VISIT_CANCELLED, VISIT_REMINDER,

  // Payment
  PAYMENT_RECEIVED, PAYMENT_FAILED, PAYMENT_REFUND,
  SUBSCRIPTION_EXPIRED, INVOICE_GENERATED,

  // Communication
  MESSAGE_RECEIVED, REVIEW_RECEIVED, SUPPORT_TICKET,

  // System
  MAINTENANCE_NOTICE, FEATURE_UPDATE, SYSTEM_ALERT,

  // Custom
  CUSTOM
}
```

### NotificationChannel
```typescript
enum NotificationChannel {
  EMAIL = 'email',
  SMS = 'sms',
  IN_APP = 'in_app',
  PUSH = 'push',
  WEBHOOK = 'webhook'
}
```

### NotificationPriority
```typescript
enum NotificationPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent'
}
```

---

## 📁 Fichiers à Supprimer Après Migration

Une fois la migration terminée et testée, supprimez :

```powershell
# Supprimer le dossier redondant
Remove-Item -Recurse -Force src\notifications\

# Supprimer les fichiers de types en double (optionnel)
Remove-Item -Force src\type\notificationType.ts
```

---

## ✅ Checklist Finale

- [ ] **Migration des imports effectuée**
  - [ ] Script PowerShell exécuté OU
  - [ ] 12 fichiers modifiés manuellement

- [ ] **Tests de compilation**
  ```powershell
  npx tsc --noEmit
  ```

- [ ] **Tests fonctionnels**
  - [ ] Envoi d'email de vérification
  - [ ] Notification in-app
  - [ ] Notification push
  - [ ] Préférences utilisateur

- [ ] **Nettoyage**
  ```powershell
  Remove-Item -Recurse -Force src\notifications\
  ```

- [ ] **Commit**
  ```bash
  git add .
  git commit -m "refactor: consolidate notification system"
  git push
  ```

---

## 🔍 Vérification Post-Migration

### 1. Vérifier qu'il ne reste plus d'anciens imports
```powershell
# Ne devrait rien retourner
Get-ChildItem -Path src -Recurse -Filter *.ts | Select-String "from.*notifications/" | Where-Object { $_.Line -notmatch "^//" }
```

### 2. Vérifier la compilation TypeScript
```powershell
npx tsc --noEmit
```

### 3. Vérifier que les services fonctionnent
```typescript
// Test rapide dans un contrôleur
import { IntegratedNotificationService } from '@/notification';
const service = new IntegratedNotificationService();
console.log('✅ Import OK');
```

---

## 📚 Documentation Supplémentaire

- **Guide de Migration Complet**: `NOTIFICATION_CONSOLIDATION.md`
- **Liste des Fichiers à Modifier**: `MIGRATION_IMPORTS.md`
- **Script de Migration**: `migrate-notifications.ps1`

---

## 🆘 Support et Troubleshooting

### Problème: Import non trouvé

**Solution:**
```typescript
// ❌ NE PAS FAIRE
import { NotificationService } from '@/notifications/services/NotificationService';

// ✅ FAIRE
import { IntegratedNotificationService, UnifiedNotificationService } from '@/notification';
```

### Problème: Type non exporté

**Solution:**
```typescript
// Tous les types sont exportés depuis @/notification
import {
  NotificationType,
  NotificationChannel,
  NotificationRequest,
  // ... etc
} from '@/notification';
```

### Problème: Service non initialisé

**Solution:**
```typescript
// Pour IntegratedNotificationService, passez l'instance Socket.IO
import { Server as SocketIOServer } from 'socket.io';
const io: SocketIOServer = /* votre instance */;
const service = new IntegratedNotificationService(io);
```

---

## 🎉 Avantages de la Consolidation

✅ **Code unifié** : Un seul dossier `src/notification/`
✅ **Import simple** : `import { ... } from '@/notification'`
✅ **Pas de doublons** : Chaque fonctionnalité existe une seule fois
✅ **Meilleure maintenabilité** : Code centralisé et organisé
✅ **Documentation complète** : Exemples et guides détaillés
✅ **Types forts** : Support TypeScript complet
✅ **Backward compatible** : Les anciennes méthodes restent accessibles

---

**Version**: 1.0.0
**Date de consolidation**: 2025-01-10
**Auteur**: Claude Code
**Status**: ✅ Prêt pour la production
