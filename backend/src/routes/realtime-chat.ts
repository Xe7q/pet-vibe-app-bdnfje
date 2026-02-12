import type { App } from '../index.js';
import type { WebSocket } from 'ws';

// Store WebSocket connections for chat messages
// Map: userId -> Set of WebSocket connections
const chatConnections = new Map<string, Set<WebSocket>>();

let appInstance: App;

export function registerRealtimeChatRoutes(app: App) {
  appInstance = app;
  // WebSocket route for real-time chat messaging
  app.fastify.route({
    method: 'GET',
    url: '/api/ws/chat',
    schema: {
      description: 'WebSocket endpoint for real-time chat messaging',
      tags: ['websocket'],
    },
    wsHandler: async (socket, request) => {
      const auth = app.requireAuth();
      const session = await auth(request, {} as any);

      if (!session) {
        app.logger.warn(
          { path: '/api/ws/chat' },
          'Unauthorized WebSocket connection attempt'
        );
        socket.send(JSON.stringify({ error: 'Unauthorized' }));
        socket.close();
        return;
      }

      const userId = session.user.id;

      // Register this connection
      if (!chatConnections.has(userId)) {
        chatConnections.set(userId, new Set());
      }
      chatConnections.get(userId)!.add(socket);

      app.logger.info(
        { userId, connectionCount: chatConnections.get(userId)!.size },
        'User connected to chat'
      );

      socket.on('message', (raw) => {
        try {
          const message = JSON.parse(raw.toString());
          app.logger.info(
            { userId, message },
            'Received chat WebSocket message'
          );
        } catch (error) {
          app.logger.error(
            { err: error, userId, raw: raw.toString() },
            'Invalid JSON in chat message'
          );
        }
      });

      socket.on('close', () => {
        chatConnections.get(userId)?.delete(socket);
        app.logger.info(
          { userId, connectionCount: chatConnections.get(userId)?.size || 0 },
          'User disconnected from chat'
        );
      });

      socket.on('error', (error) => {
        app.logger.error(
          { err: error, userId },
          'WebSocket error in chat'
        );
      });
    },
    handler: async (request, reply) => {
      return { protocol: 'ws', path: '/api/ws/chat' };
    },
  });
}

// Export function to broadcast chat messages
export function broadcastChatMessage(messageData: {
  messageId: string;
  conversationId: string;
  senderId: string;
  otherUserId: string;
  content: string | null;
  imageUrl: string | null;
  createdAt: Date;
}) {
  const notification = JSON.stringify({
    type: 'message',
    data: {
      messageId: messageData.messageId,
      conversationId: messageData.conversationId,
      senderId: messageData.senderId,
      content: messageData.content,
      imageUrl: messageData.imageUrl,
      createdAt: messageData.createdAt,
    },
  });

  // Send to other user if they're connected
  const otherUserConnections = chatConnections.get(messageData.otherUserId);
  if (otherUserConnections && otherUserConnections.size > 0) {
    for (const socket of otherUserConnections) {
      if (socket.readyState === 1) { // OPEN
        socket.send(notification);
        appInstance?.logger.info(
          {
            otherUserId: messageData.otherUserId,
            messageId: messageData.messageId,
          },
          'Chat message broadcasted to user'
        );
      }
    }
  } else {
    appInstance?.logger.info(
      { otherUserId: messageData.otherUserId },
      'Other user not connected - message will be retrieved on next poll'
    );
  }
}
