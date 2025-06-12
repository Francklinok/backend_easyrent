import Conversation from "../model/conversationModel";
import Message from "../model/chatModel";
import { EventEmitter } from 'events';
import { NotificationService } from "../../services/notificationServices";

class  ChatServices extends EventEmitter{
    constructor(io){
        super();
        this.io = io;
        this.notificationService = new NotificationService();
        this.cacheService = new Cacheservice();
        this.messsageQueue = new MessageQueue();
    }
   /**
   * Crée ou récupère une conversation existante
   */  
    async createOrGetConversation({participantId, type = "direct",  propertyId, userId}){
        try{
            const cacheKey = `conversation:${userId}:${participantId}:${type}`;
            // verifier le cache
            let conversation = await  this.cacheService.get(cacheKey)
            if(!conversation){
                if(type== 'direct'){
                    conversation = await  Conversation.findOne({
                        participants: { $all: [userId, participantId], $size: 2 },
                        type: 'direct'
                        
                    }).populate('participants', 'name  avatar email  isOnline  lastSeen');
                }
                if(!conversation){
                    conversation = new Conversation({
                        participants: type === 'direct' ? [userId, participantId] : [userId],
                        type,
                        propertyId,
                        createdAt: new Date(),
                        settings: {
                        encryptionEnabled: true,
                        messageRetention: 30, // jours
                        allowFileSharing: true,
                        allowVoiceMessages: true
                        },
                        analytics: {
                        messageCount: 0,
                        participantActivity: []
                        }
                    });
                    await  conversation.save()
                    await  conversation.populate('participants', 'name avatar email  isOnline  lastSeen')
                    //emettre   evenement  de  nouvelle   conversation
                    this .emit('conversationCreated',  converstion);

                }
                //ùettre   en cache  
                await  this.CacheService.set(cacheKey, conversation,3600);
            }
            return   conversation

        }catch(error){
            this.emit('error', {operation:'createOrGetConversation',  error})
            throw  error
        }
    }

    /**
     * Recuperer   les  conversation  d  un   utilisateur   avec  pagination et  filtres
     */

    async   getUserConversations({userId,  page = 1, limit = 20, filter = 'all'}){
        try{
            const cacheKey = `user_conversations:${userId}:${page}:${limit}:${filter}`;
            // veriifier  le cache
            let  cachedResult =  await  this.cacheService.get(cacheKey);
            if(cacheKey)return  cachedResult;

            let  query = {participants: userId};

            switch(filter){
                case 'unread':
                    break;
                case 'groups':
                    query.type = 'group';
                    break;
                case  'direct':
                    query.type = 'direct';
                    break;
                
            }
            const  conversations = await  Conversation.find(query)
            .populate('participants', 'name avatar email  isOnline lastSeen')
            .populate('propertyId', 'title price images location')
            .sort({updateAt:-1})
            .limit(limit)
            .skip((page-1) * limit);

            const  enrichedConversations = await  Promise.all(
                conversations.map(async (conv) =>{
                    const  [lastMessage,   unreadCount,  typingUsers] = await  Promise.all([
                       this.getLastMessage(conv._id),
                       this.getUnreadCount(conv._id, userId),
                       this.getTypingUsers(conv._id,  userId)
                    ]);

                    return  {
                        ... conv.toObject(),
                        lastMessage,
                        unreadCount,
                        typingUsers,
                        isOnline:this.getConversationOnlineStatus(conv.participants),
                        encryptionStatus:conv.settings?.encryptionEnabled?'enabled':'disabled'
                    }
                })
            );
            //filtrer   les  ocnversation  non lue 
            const   result =  filter ==='unread'
            ? enrichedConversations.filter(conv => conv.unreadCount > 0)
            :enrichedConversations;

            await this.cacheService.set(cacheKey, result, 300);
            return   result;

        }catch(error){
            this.emit('error', {
                operation:'getUserConversations', error
            })
            throw  error
        }
    }


     /**
   * Envoie un message avec traitement avancé
   */
  async  sendMessage(
   { conversationId,
     content,
      messageType = 'text', 
      replyTo, 
      scheduleFor,
       userId,
        file,
        priority = 'normal',
        mention = []}
     ){
        try{
            await  this.validateMessageInput({
                conversationId, content, messagetype, userId
            });
            let  mediaData = null;
            let  processedContent =  content;
            if(file){
                mediaData = await  this.processMediaFile(file)
            }

            //traitement  du  contenu   avec  l IA
            const  aiInsights = await  this.analyzeMessageContent(content,   messageType,  userId);
            // traiter  les  mentions
            const   processedMentions = await  this.processMentions(content,  MediaElementAudioSourceNode,  conversationId);
            //chiffrement  du   contenu
            const  conversation = await  Conversation.findById(conversationId);
            if(conversation.settings?.encryptionEnabled){
                processedContent = await  this.encryptMessage(content);
            }

            const   messageData = {
                conversationId,
                senderId:userId,
                content:processedContent,
                originalContent:content,
                messageType,
                mediaData,
                replyTo: replyTo || null,
                scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
                isScheduled: !!scheduledFor,
                priority,
                mentions: processedMentions,
                aiInsights,
                status: {
                sent: new Date(),
                delivered: [],
                read: []
                },
                metadata: {
                userAgent: aiInsights.userAgent,
                location: aiInsights.location,
                sentiment: aiInsights.sentiment
                }
            };
            if(scheduleFor){
                return  await  this.scheduleMessage(messageData);
            }
            const  message = new  Message(messageData)
            await message.save();
            await  this  populateMessage(message)
            // update  the  conversation
            this.processMessageAsync(message,  conversation);
            return  message;
        }catch(error){
            this.emit('error', {
                operation:'sendMessage',error
            });
            throw error
        }
     }

    /**
   * Traitement asynchrone du message
   */
  async  processMessageAsync(message,  conversation){

    try{
        await  this.notificationService.sendMessageNotifications(message,  conversation)
        //  emettre  via  websocket  
        this.emitMessagetoParticipants(message,  conversation);

        await  this.indexMessageForSearch(message);
        
        // Analyser les patterns de conversation
        await  this.analyzeConversationPatterns(conversation._id);
        //netoyer le cache
        await thiss.invalidateConversationcache(conversation._id);

    }catch(error){
        this.emit('error',{
            operation:'processMessageAsync',  error
        })
    }
  }

   /**
   * Récupère les messages avec pagination et filtres avancés
   */

   async  getMessage({
    conversationId,
    userId,
    page=  1,
    limit = 50,
    messageType = null,
    dateRange = null,
    searchQuery = null
   }){
    try{
        let  query = {
            conversationId,
            $or: [
          { isDeleted: false },
          { isDeleted: true, deletedFor: { $ne: userId } }
        ] 
        };

        //  filtre supplementaire

        if(messageType)query.messageType = messageType;
        if(dateRange){
            query.createdAt = {
                $gte: new Date(dateRange.start),
                $lte: new Date(dateRange.end)
            };
        }
        if (searchQuery) {
           query.$text = { $search: searchQuery };
      }

      const messages =   await  Message.find(query)
        .populate('senderId', 'name avatar isOnline')
        .populate('replyTo')
        .populate('mentions.userId', 'name avatar')
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip((page - 1) * limit);

        //Marquer  comme  lus
        await  this.markMessagesAsRead(conversationId, userId);
        //dechiffrer si  necessaire
        const   decryptedMessages = await  Promise.all(
            messages.map(msg => this.decryptMessageIfNeeded(msg))
        )
        return decryptedMessages.revers();

    }catch(error){
        this.emit('error', { operation: 'getMessages', error });
      throw error;
    }
   }
     
   /**
   * Système de réactions avancé
   */
  async  reactToMessage({
    messageId, 
    emoji, 
    userId, 
    customReaction = null}){

        try{
            const   message = await  Message.findById(messageId)
            if(!message) throw  new  Error('Message  non trouvé')

            message.reactions = message.reactions.filter(
                r =>r.userId.toString() !== userId
            );
            if(emoji || customReaction){
                const  reaction = {
                    userId,
                    emoji:emoji|| customReaction.emoji,
                    timestamp: new Date()
                };

            if(customReaction){
                reaction.isCustom = true;
                reaction.customData = customReaction;
            }

            message.reactions.push(reaction);

            //Analytics   des  reactions
            await  this.trackReactionananlytics(messageId, userId, emoji ||  customReaction.emoji )
            }
            await  message.save();
            //emettre  en temps  reel 
            const  conversation= await   Conversation.findById(message.conversationId);
            this.emitReactionToParticipants(messageId, message.reactions, conversation);
            return  {
                success:true,
                reactions:message.reactions
            }
        }catch(error){
            this.emit('error', { operation: 'reactToMessage', error });
            throw error;
        }
  }

  
  /**
   * Système de suppression intelligent
   */

  async  deleteMessage({messageId,  deleteFor = 'me', userId,  reason = null}){
    try{
        const message = await Message.findById(messageId);
        if(!message){
            logger.info('message nn trouver')
            return 
        }

        const   canDeleteForEveryone = message.senderId.toString() === userId ||
        await this.userHasDeletePermission(userId, message.conversationId)

        if (deleteFor === 'everyone' && !canDeleteForEveryone) {
            throw new Error('Non autorisé à supprimer pour tous');
        }
         // Sauvegarder pour audit
      await this.createDeleteAuditLog(message, userId, deleteFor, reason);

      if (deleteFor === 'everyone') {
        message.isDeleted = true;
        message.deletedAt = new Date();
        message.deletedBy = userId;
        message.deleteReason = reason;
        message.content = null;
        message.mediaData = null;
      } else {
        message.deletedFor.push(userId);
      }

      await message.save();

      //emetre  la suppression

      const  conversation =  await  Conversation.findById(message.conversationId);
      this.emitMessageDeletion(messageId,  deleteFor,userId,  conversation)
      return { success: true };

    }catch(error){
      this.emit('error', { operation: 'deleteMessage', error });
      throw error;
    }
  }
  
    /**
     * Recherche avancée dans les messages
     */
    async searchMessages({
      userId,
      query,
      conversationId = null,
      messageType = null,
      dateRange = null,
      page = 1,
      limit = 20
    }) {
      try {
        let searchQuery = {
          $text: { $search: query },
          $or: [
            { isDeleted: false },
            { isDeleted: true, deletedFor: { $ne: userId } }
          ]
        };
  
        // Filtrer par conversation si spécifié
        if (conversationId) {
          searchQuery.conversationId = conversationId;
        } else {
          // Récupérer les conversations de l'utilisateur
          const userConversations = await Conversation.find(
            { participants: userId }
          ).select('_id');
          
          searchQuery.conversationId = {
            $in: userConversations.map(c => c._id)
          };
        }
  
        if (messageType) searchQuery.messageType = messageType;
        if (dateRange) {
          searchQuery.createdAt = {
            $gte: new Date(dateRange.start),
            $lte: new Date(dateRange.end)
          };
        }
  
        const messages = await Message.find(searchQuery)
          .populate('senderId', 'name avatar')
          .populate('conversationId', 'type participants')
          .sort({ score: { $meta: 'textScore' }, createdAt: -1 })
          .limit(limit)
          .skip((page - 1) * limit);
  
        return messages;
      } catch (error) {
        this.emit('error', { operation: 'searchMessages', error });
        throw error;
      }
    }
    
      async processMediaFile(file) {
        const mediaData = {
          filename: file.filename,
          originalName: file.originalname,
          size: file.size,
          mimetype: file.mimetype,
          uploadedAt: new Date()
        };
    
        if (file.mimetype.startsWith('image/')) {
          const imagePath = file.path;
          const metadata = await sharp(imagePath).metadata();
          mediaData.dimensions = { width: metadata.width, height: metadata.height };
    
          // Créer plusieurs tailles
          const sizes = ['thumbnail', 'medium', 'large'];
          mediaData.variants = {};
    
          for (const size of sizes) {
            const { width, height, quality } = this.getImageSizeConfig(size);
            const variantPath = `uploads/${size}_${file.filename}`;
            
            await sharp(imagePath)
              .resize(width, height, { fit: 'inside', withoutEnlargement: true })
              .jpeg({ quality })
              .toFile(variantPath);
    
            mediaData.variants[size] = variantPath;
          }
        }
    
        return mediaData;
      }
    
      async analyzeMessageContent(content, messageType, userId) {
        try {
          const analysis = await analyzeMessageWithAI(content, messageType);
          
          return {
            ...analysis,
            timestamp: new Date(),
            userId,
            language: await this.detectLanguage(content),
            topics: await this.extractTopics(content),
            urgency: this.assessUrgency(content, analysis.sentiment)
          };
        } catch (error) {
          return { error: 'Analysis failed', timestamp: new Date() };
        }
      }
    
      async processMentions(content, mentions, conversationId) {
        const mentionPattern = /@(\w+)/g;
        const extractedMentions = [];
        let match;
    
        while ((match = mentionPattern.exec(content)) !== null) {
          const username = match[1];
          // Trouver l'utilisateur dans la conversation
          const user = await this.findUserInConversation(username, conversationId);
          if (user) {
            extractedMentions.push({
              userId: user._id,
              username: user.username,
              position: match.index,
              length: match[0].length
            });
          }
        }
    
        return [...extractedMentions, ...mentions];
      }
    
      emitMessageToParticipants(message, conversation) {
        conversation.participants.forEach(participantId => {
          if (participantId.toString() !== message.senderId.toString()) {
            this.io.to(participantId.toString()).emit('newMessage', {
              ...message.toObject(),
              conversationId: conversation._id,
              conversationType: conversation.type
            });
          }
        });
      }
    
      async invalidateConversationCache(conversationId) {
        const conversation = await Conversation.findById(conversationId);
        for (const participantId of conversation.participants) {
          await this.cacheService.deletePattern(`user_conversations:${participantId}:*`);
        }
      }
    
      getImageSizeConfig(size) {
        const configs = {
          thumbnail: { width: 150, height: 150, quality: 60 },
          medium: { width: 800, height: 600, quality: 80 },
          large: { width: 1920, height: 1080, quality: 90 }
        };
        return configs[size] || configs.medium;
      }

  
}

export default ChatService;
