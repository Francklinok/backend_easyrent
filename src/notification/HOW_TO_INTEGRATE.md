# 📱 Comment intégrer le système de notifications Instagram-style

## 🚀 Remplacement des anciens services

### 1. Dans votre `app.ts` ou fichier principal

```typescript
import { Server as SocketIOServer } from 'socket.io';
import { IntegratedNotificationService, EnhancedActivityService, EnhancedPropertyService } from './src/notification';

// Initialisation avec Socket.IO pour les notifications temps réel
const io = new SocketIOServer(server);

// Services enrichis avec notifications automatiques
const notificationService = new IntegratedNotificationService(io);
const activityService = new EnhancedActivityService(io);
const propertyService = new EnhancedPropertyService(io);

// Rendre accessible dans toute l'app
app.set('notificationService', notificationService);
app.set('activityService', activityService);
app.set('propertyService', propertyService);
```

### 2. Remplacement dans les contrôleurs

#### Avant (ActivityController) :
```typescript
import ActivityServices from '../service/ActivityServices';

// Ancien code
const activityService = new ActivityServices(io);
const result = await activityService.createVisite(visitData);
```

#### Après (ActivityController) :
```typescript
import { EnhancedActivityService } from '../../../notification';

// Nouveau code avec notifications automatiques
const activityService = req.app.get('activityService') as EnhancedActivityService;
const result = await activityService.createVisite(visitData);
// ✅ Notifications automatiques : email + in-app + SMS !
```

#### Avant (PropertyController) :
```typescript
import PropertyServices from '../proprityServices/proprityServices';

// Ancien code
const propertyService = new PropertyServices();
const result = await propertyService.createProperty(propertyData);
```

#### Après (PropertyController) :
```typescript
import { EnhancedPropertyService } from '../../../notification';

// Nouveau code avec notifications automatiques
const propertyService = req.app.get('propertyService') as EnhancedPropertyService;
const result = await propertyService.createProperty(propertyData);
// ✅ Notification broadcast à TOUS les utilisateurs (style Instagram) !
```

## 🎯 Fonctionnalités automatiques ajoutées

### Notifications de Propriétés (style Instagram)

1. **Nouvelle propriété** → Broadcast à tous les utilisateurs connectés
2. **Changement de prix** → Notification aux utilisateurs intéressés
3. **Propriété disponible** → Notification ciblée par zone géographique
4. **Statut modifié** → Notification au propriétaire

### Notifications d'Activités (ciblées)

1. **Demande de visite** → Email + In-app au propriétaire
2. **Visite acceptée/refusée** → Email + SMS + In-app au client
3. **Demande de réservation** → Email + In-app au propriétaire
4. **Réservation acceptée/refusée** → Email + SMS + In-app au client
5. **Paiement effectué** → Email + In-app au propriétaire ET au client
6. **Rappels automatiques** → SMS pour visites et paiements

## 📝 Exemple concret d'intégration

### ActivityController.ts
```typescript
import { Request, Response } from 'express';
import { EnhancedActivityService } from '../../../notification';

class ActivityController {

  // ✅ Création de visite avec notifications automatiques
  async createVisite(req: Request, res: Response) {
    try {
      const activityService = req.app.get('activityService') as EnhancedActivityService;

      const result = await activityService.createVisite(req.body);

      // Les notifications suivantes sont envoyées AUTOMATIQUEMENT :
      // 1. Email au propriétaire avec détails de la demande
      // 2. Notification in-app temps réel au propriétaire
      // 3. Message dans le chat automatique
      // 4. Programmation d'un rappel 2h avant la visite

      res.status(201).json({
        success: true,
        data: result,
        message: 'Visite créée avec notifications envoyées'
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // ✅ Acceptation de visite avec notifications
  async acceptVisit(req: Request, res: Response) {
    try {
      const activityService = req.app.get('activityService') as EnhancedActivityService;

      const result = await activityService.acceptVisit(req.params.activityId);

      // Notifications automatiques :
      // 1. Email de confirmation au client
      // 2. SMS au client avec détails
      // 3. Notification in-app au client
      // 4. Message chat automatique

      res.status(200).json({
        success: true,
        data: result,
        message: 'Visite acceptée, client notifié'
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // ✅ Accès aux notifications pour cas personnalisés
  async sendCustomNotification(req: Request, res: Response) {
    try {
      const activityService = req.app.get('activityService') as EnhancedActivityService;

      const result = await activityService.notifications.sendCustomNotification({
        userId: req.body.userId,
        type: 'custom',
        channels: ['in_app', 'email'],
        title: req.body.title,
        message: req.body.message
      });

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // ✅ Statistiques de notifications
  async getNotificationStats(req: Request, res: Response) {
    try {
      const activityService = req.app.get('activityService') as EnhancedActivityService;

      const stats = await activityService.getNotificationStats(req.user.id);

      res.status(200).json({ success: true, data: stats });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}
```

### PropertyController.ts
```typescript
import { Request, Response } from 'express';
import { EnhancedPropertyService } from '../../../notification';

class PropertyController {

  // ✅ Création de propriété avec broadcast Instagram-style
  async createProperty(req: Request, res: Response) {
    try {
      const propertyService = req.app.get('propertyService') as EnhancedPropertyService;

      const result = await propertyService.createProperty(req.body, req.user.id);

      // 🔥 NOTIFICATIONS AUTOMATIQUES STYLE INSTAGRAM :
      // 1. Notification in-app à TOUS les utilisateurs connectés
      // 2. Emails aux utilisateurs qui cherchent dans cette zone
      // 3. Notifications aux utilisateurs avec critères similaires
      // 4. Planification de rappels au propriétaire

      res.status(201).json({
        success: true,
        data: result,
        message: 'Propriété créée et diffusée à tous les utilisateurs!'
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // ✅ Mise à jour avec notifications conditionnelles
  async updateProperty(req: Request, res: Response) {
    try {
      const propertyService = req.app.get('propertyService') as EnhancedPropertyService;

      const result = await propertyService.updateProperty({
        propertyId: req.params.id,
        data: req.body
      });

      // Notifications automatiques selon les changements :
      // - Prix baissé → Notification aux intéressés
      // - Statut changé → Notification au propriétaire
      // - Disponible → Notification dans la zone

      res.status(200).json({
        success: true,
        data: result,
        message: 'Propriété mise à jour avec notifications'
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}
```

## 🔧 Configuration côté client (Socket.IO)

### JavaScript/TypeScript Frontend
```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000');

// Authentification pour les notifications personnalisées
socket.emit('authenticate', {
  userId: currentUser.id,
  token: authToken
});

// Écouter les nouvelles notifications
socket.on('new_notification', (notification) => {
  console.log('📱 Nouvelle notification:', notification);

  // Afficher dans l'UI
  showNotificationToast(notification);

  // Mettre à jour le badge
  updateNotificationBadge();
});

// Écouter les notifications broadcast (nouvelles propriétés)
socket.on('broadcast_notification', (notification) => {
  console.log('📢 Nouvelle propriété:', notification);

  // Affichage spécial pour les nouvelles propriétés
  showPropertyAlert(notification);
});

// Compteur de notifications non lues
socket.on('unread_count_updated', (data) => {
  document.getElementById('notification-badge').textContent = data.count;
});

// Marquer une notification comme lue
function markAsRead(notificationId) {
  socket.emit('mark_as_read', { notificationId });
}

// Marquer toutes comme lues
function markAllAsRead() {
  socket.emit('mark_all_as_read');
}
```

## 📊 API endpoints de notifications

Ajoutez ces routes pour gérer les notifications :

```typescript
// routes/notificationRoutes.ts
import { Router } from 'express';

const router = Router();

// Obtenir les notifications d'un utilisateur
router.get('/notifications', async (req, res) => {
  const notificationService = req.app.get('notificationService');

  const notifications = await notificationService.getUserNotifications(
    req.user.id,
    {
      page: req.query.page || 1,
      limit: req.query.limit || 20,
      type: req.query.type
    }
  );

  res.json({ success: true, data: notifications });
});

// Marquer comme lue
router.put('/notifications/:id/read', async (req, res) => {
  const notificationService = req.app.get('notificationService');

  const result = await notificationService.markNotificationAsRead(
    req.params.id,
    req.user.id
  );

  res.json({ success: result });
});

// Statistiques
router.get('/notifications/stats', async (req, res) => {
  const notificationService = req.app.get('notificationService');

  const stats = await notificationService.getNotificationStats(req.user.id);

  res.json({ success: true, data: stats });
});

export default router;
```

## 🎨 Templates d'emails personnalisés

Le système inclut des templates prêts pour :

- ✅ Demande de visite
- ✅ Confirmation/refus de visite
- ✅ Demande de réservation
- ✅ Confirmation/refus de réservation
- ✅ Confirmation de paiement
- ✅ Nouvelle propriété disponible
- ✅ Baisse de prix
- ✅ Rappels automatiques

## 🚦 Migration en douceur

1. **Gardez les anciens services** en parallèle au début
2. **Testez progressivement** les nouveaux services
3. **Remplacez contrôleur par contrôleur**
4. **Supprimez les anciens services** une fois tout testé

## ✨ Résultat final

- **Style Instagram** : Chaque nouvelle propriété notifie tous les utilisateurs
- **Notifications ciblées** : Les activités notifient seulement les concernés
- **Multi-canaux** : Email + SMS + In-app automatiques
- **Temps réel** : Notifications instantanées via Socket.IO
- **Rappels intelligents** : Planification automatique
- **Emails riches** : Templates HTML personnalisés
- **Statistiques** : Analytics complètes des notifications

Le système est maintenant prêt à remplacer complètement vos anciens services ! 🎉