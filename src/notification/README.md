# Système de Notification EasyRent

Un système complet de gestion des notifications supportant multiple canaux de communication : Email, SMS, et notifications in-app.

## 🚀 Fonctionnalités

- **Multi-canaux** : Email, SMS, notifications in-app, push notifications, webhooks
- **Templates** : Système de templates avec variables dynamiques
- **Planification** : Envoi de notifications programmées
- **Queue intelligente** : Gestion automatique de la file d'attente avec retry
- **Rate limiting** : Respect des limites des fournisseurs
- **Historique complet** : Suivi détaillé des deliveries et statuts
- **Temps réel** : Notifications in-app via Socket.IO
- **Statistiques** : Analytics détaillés des notifications

## 📋 Structure

```
src/notification/
├── types/
│   └── notificationTypes.ts        # Types et interfaces TypeScript
├── models/
│   └── Notification.ts             # Modèles MongoDB
├── services/
│   ├── EmailNotificationService.ts # Service email (SendGrid/SMTP)
│   ├── SmsNotificationService.ts   # Service SMS (Twilio)
│   ├── InAppNotificationService.ts # Notifications in-app (Socket.IO)
│   └── NotificationManager.ts      # Gestionnaire principal
├── index.ts                        # Point d'entrée principal
└── README.md                       # Cette documentation
```

## 🔧 Installation et Configuration

### 1. Configuration des services

Ajoutez à votre `config/index.ts` :

```typescript
export default {
  // Configuration email (déjà existante)
  sendgrid: {
    enabled: true,
    apiKey: process.env.SENDGRID_API_KEY,
    fromAddress: process.env.FROM_EMAIL
  },

  // Configuration SMS (Twilio)
  twilio: {
    enabled: process.env.TWILIO_ENABLED === 'true',
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    fromNumber: process.env.TWILIO_FROM_NUMBER
  }
};
```

### 2. Variables d'environnement

```env
# SMS Configuration
TWILIO_ENABLED=true
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_FROM_NUMBER=+1234567890
```

### 3. Initialisation dans votre app

```typescript
import { Server as SocketIOServer } from 'socket.io';
import { NotificationManager } from './src/notification';

// Dans votre fichier principal (app.ts)
const io = new SocketIOServer(server);
const notificationManager = new NotificationManager(io);

// Rendre accessible globalement
app.set('notificationManager', notificationManager);
```

## 🎯 Utilisation

### 1. Envoi de notification simple

```typescript
import { NotificationManager, NotificationChannel, NotificationType } from './src/notification';

const notificationManager = new NotificationManager();

await notificationManager.sendNotification({
  userId: 'user123',
  type: NotificationType.BOOKING_CONFIRMED,
  channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
  title: 'Réservation confirmée',
  message: 'Votre réservation a été confirmée avec succès !',
  data: {
    email: {
      to: 'user@example.com',
      subject: 'Réservation confirmée - EasyRent',
      htmlContent: '<h1>Réservation confirmée</h1>...'
    },
    inApp: {
      userId: 'user123',
      title: 'Réservation confirmée',
      message: 'Votre réservation a été confirmée',
      actionUrl: '/bookings/123',
      actionLabel: 'Voir détails'
    }
  }
});
```

### 2. Utilisation avec templates

```typescript
await notificationManager.sendTemplateNotification('booking_confirmation', {
  firstName: 'Jean',
  propertyName: 'Appartement 3 pièces',
  checkIn: '15/01/2024',
  checkOut: '22/01/2024',
  amount: '450'
}, {
  userId: 'user123',
  channels: [NotificationChannel.EMAIL, NotificationChannel.SMS],
  type: NotificationType.BOOKING_CONFIRMED
});
```

### 3. Notification planifiée

```typescript
// Programmer une notification de rappel
const scheduledDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // Dans 24h

await notificationManager.scheduleNotification({
  userId: 'user123',
  type: NotificationType.VISIT_REMINDER,
  channels: [NotificationChannel.SMS, NotificationChannel.IN_APP],
  title: 'Rappel de visite',
  message: 'N\'oubliez pas votre visite demain à 14h',
  data: {
    sms: {
      to: '+33123456789',
      message: 'Rappel: Visite demain 14h - Appartement rue de la Paix'
    }
  }
}, scheduledDate);
```

### 4. Notifications in-app temps réel

```typescript
// Côté serveur - envoi en temps réel
await notificationManager.inApp.sendRealTimeNotification('user123', {
  title: 'Nouveau message',
  message: 'Vous avez reçu un nouveau message',
  type: NotificationType.MESSAGE_RECEIVED,
  actionUrl: '/messages',
  icon: 'message'
});

// Côté client JavaScript
const socket = io();

socket.emit('authenticate', { userId: 'user123', token: 'jwt_token' });

socket.on('new_notification', (notification) => {
  console.log('Nouvelle notification:', notification);
  // Afficher dans l'UI
});

socket.on('unread_count_updated', (data) => {
  console.log('Notifications non lues:', data.count);
  // Mettre à jour le badge
});
```

### 5. Services individuels

```typescript
// Service Email uniquement
const emailService = notificationManager.email;

await emailService.sendTemplateEmail('welcome', {
  to: 'user@example.com',
  subject: 'Bienvenue !',
  templateData: { firstName: 'Jean' }
}, 'user123');

// Service SMS uniquement
const smsService = notificationManager.sms;

await smsService.sendVerificationSms('+33123456789', '123456', 'user123');

// Service In-App uniquement
const inAppService = notificationManager.inApp;

await inAppService.sendNotification({
  userId: 'user123',
  title: 'Test',
  message: 'Message de test',
  persistent: true
});
```

## 📊 Monitoring et Statistiques

### Obtenir les statistiques

```typescript
const stats = await notificationManager.getNotificationStats('user123');
console.log('Statistiques:', {
  total: stats.total,
  envoyées: stats.sent,
  lues: stats.read,
  parCanal: stats.byChannel
});
```

### Vérifier le statut des services

```typescript
const servicesStatus = await notificationManager.getAllServicesStatus();
console.log('Statut des services:', servicesStatus);

const testResults = await notificationManager.testAllServices();
console.log('Tests de configuration:', testResults);
```

### Historique des notifications

```typescript
// Récupérer l'historique d'une notification
const history = await NotificationHistory.find({ userId: 'user123' })
  .populate('notificationId')
  .sort({ createdAt: -1 });
```

## 🔌 Intégration avec l'existant

Le système utilise et complète le `NotificationService` existant dans `src/services/notificationServices.ts`. Il :

- Réutilise la configuration email existante (SendGrid/SMTP)
- Ajoute le support SMS via Twilio
- Fournit un système complet de notifications in-app
- Maintient la compatibilité avec le code existant

## 🎨 Templates disponibles

### Templates Email
- `welcome` : Email de bienvenue
- `verification` : Code de vérification
- `password_reset` : Réinitialisation de mot de passe
- `booking_confirmation` : Confirmation de réservation
- `payment_confirmation` : Confirmation de paiement

### Templates SMS
- `verification` : Code de vérification SMS
- `booking_reminder` : Rappel de réservation
- `payment_reminder` : Rappel de paiement
- `visit_reminder` : Rappel de visite
- `emergency_alert` : Alerte urgente

## 🔐 Sécurité

- Validation des adresses email et numéros de téléphone
- Rate limiting par service
- Masquage des informations sensibles dans les logs
- Support de l'authentification JWT pour les notifications in-app
- Expiration automatique des notifications
- Nettoyage automatique des données expirées

## 🚦 Gestion d'erreur et Retry

- Retry automatique en cas d'échec (configurable)
- Queue avec gestion de priorité
- Fallback entre services (ex: SendGrid -> SMTP)
- Logging détaillé des erreurs
- Tracking complet des tentatives de delivery

## 🔧 Développement et Debug

### Mode développement

Les services fournissent des logs détaillés en mode développement et des informations de debug.

### Tests

```bash
# Tester la configuration email
GET /api/notifications/test/email

# Tester la configuration SMS
GET /api/notifications/test/sms

# Obtenir le statut de tous les services
GET /api/notifications/status
```

## 📈 Performance

- Traitement en batch pour les envois en masse
- Rate limiting respectant les limites des providers
- Queue avec traitement asynchrone
- Nettoyage automatique des anciennes données
- Indexation optimisée des collections MongoDB

## 🤝 Contribution

Pour ajouter de nouveaux canaux ou fonctionnalités :

1. Créer un nouveau service dans `services/`
2. Implémenter l'interface `NotificationProvider`
3. Ajouter le canal dans `NotificationChannel`
4. Intégrer dans `NotificationManager`
5. Ajouter les tests correspondants