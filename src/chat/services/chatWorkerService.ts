// chatWorker.ts

import { Worker } from 'bullmq';
import { Types } from 'mongoose';
import { redisForBullMQ } from '../../lib/redisClient';
import ChatService from './chatService'; 
import { createLogger } from '../../utils/logger/logger';
import { Server as IOServer } from 'socket.io';

const logger = createLogger('ChatWorker');

const chatService = new ChatService({} as IOServer);

// Création du worker
const worker = new Worker(
  'message-delivery', // nom de la queue
  async (job) => {
    const { messageId } = job.data;
    logger.info(`Exécution du message programmé: ${messageId}`);

    await chatService.executeScheduledMessage(new Types.ObjectId(messageId));
  },
  {
    connection: redisForBullMQ, // Instance Redis dédiée
  }
);

worker.on('completed', (job) => {
  logger.info(`Job terminé: ${job.id}`);
});

worker.on('failed', (job, err) => {
  logger.error(`Job échoué: ${job?.id}`, { error: err?.message });
});
