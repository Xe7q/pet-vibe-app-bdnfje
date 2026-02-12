import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, or, desc } from 'drizzle-orm';
import * as schema from '../db/schema.js';

// Store WebSocket connections for match notifications
const wsConnections = new Map<string, Set<any>>();

export function registerMatchRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // GET /api/matches - Returns user's matches
  app.fastify.get(
    '/api/matches',
    async (request: FastifyRequest, reply: FastifyReply): Promise<any> => {
      app.logger.info(
        { userId: (request as any).user?.id },
        'Fetching user matches'
      );
      const session = await requireAuth(request, reply);
      if (!session) return;

      try {
        const userMatches = await app.db.query.matches.findMany({
          where: or(
            eq(schema.matches.user1Id, session.user.id),
            eq(schema.matches.user2Id, session.user.id)
          ),
          with: {
            pet1: true,
            pet2: true,
          },
          orderBy: desc(schema.matches.createdAt),
        });

        app.logger.info(
          { userId: session.user.id, matchCount: userMatches.length },
          'Successfully fetched user matches'
        );

        return userMatches.map((match) => {
          // Determine which pet is the other user's pet
          const isUser1 = match.user1Id === session.user.id;
          const otherUserId = isUser1 ? match.user2Id : match.user1Id;
          const otherPet = isUser1 ? match.pet2 : match.pet1;
          const myPet = isUser1 ? match.pet1 : match.pet2;

          return {
            id: match.id,
            otherUser: {
              id: otherUserId,
            },
            myPet: {
              id: myPet.id,
              name: myPet.name,
              breed: myPet.breed,
              age: myPet.age,
              photoUrl: myPet.photoUrl,
            },
            otherPet: {
              id: otherPet.id,
              name: otherPet.name,
              breed: otherPet.breed,
              age: otherPet.age,
              photoUrl: otherPet.photoUrl,
            },
            createdAt: match.createdAt,
          };
        });
      } catch (error) {
        app.logger.error(
          { err: error, userId: session.user.id },
          'Failed to fetch user matches'
        );
        throw error;
      }
    }
  );

  // WebSocket route for real-time match notifications
  app.fastify.route({
    method: 'GET',
    url: '/api/ws/matches',
    schema: {
      description: 'WebSocket endpoint for real-time match notifications',
      tags: ['websocket'],
    },
    wsHandler: async (socket, request) => {
      const auth = app.requireAuth();
      const session = await auth(request, {} as any);

      if (!session) {
        app.logger.warn(
          { path: '/api/ws/matches' },
          'Unauthorized WebSocket connection attempt'
        );
        socket.send(JSON.stringify({ error: 'Unauthorized' }));
        socket.close();
        return;
      }

      const userId = session.user.id;

      // Register this connection
      if (!wsConnections.has(userId)) {
        wsConnections.set(userId, new Set());
      }
      wsConnections.get(userId)!.add(socket);

      app.logger.info(
        { userId, connectionCount: wsConnections.get(userId)!.size },
        'User connected to match notifications'
      );

      socket.on('message', (message) => {
        app.logger.info({ userId, message: message.toString() }, 'WebSocket message received');
      });

      socket.on('close', () => {
        wsConnections.get(userId)?.delete(socket);
        app.logger.info(
          { userId, connectionCount: wsConnections.get(userId)?.size || 0 },
          'User disconnected from match notifications'
        );
      });

      socket.on('error', (error) => {
        app.logger.error(
          { err: error, userId },
          'WebSocket error'
        );
      });
    },
    handler: async (request, reply) => {
      return { protocol: 'ws', path: '/api/ws/matches' };
    },
  });
}

// Export function to broadcast match notifications
export function broadcastMatchNotification(matchData: {
  matchId: string;
  user1Id: string;
  user2Id: string;
  pet1Name: string;
  pet2Name: string;
  pet1Photo: string;
  pet2Photo: string;
}) {
  // Send to user 1
  const user1Connections = wsConnections.get(matchData.user1Id);
  if (user1Connections) {
    const message = JSON.stringify({
      type: 'match',
      data: {
        matchId: matchData.matchId,
        message: "Pawsome! It's a Match!",
        pet: {
          name: matchData.pet2Name,
          photoUrl: matchData.pet2Photo,
        },
      },
    });
    for (const socket of user1Connections) {
      if (socket.readyState === 1) { // OPEN
        socket.send(message);
      }
    }
  }

  // Send to user 2
  const user2Connections = wsConnections.get(matchData.user2Id);
  if (user2Connections) {
    const message = JSON.stringify({
      type: 'match',
      data: {
        matchId: matchData.matchId,
        message: "Pawsome! It's a Match!",
        pet: {
          name: matchData.pet1Name,
          photoUrl: matchData.pet1Photo,
        },
      },
    });
    for (const socket of user2Connections) {
      if (socket.readyState === 1) { // OPEN
        socket.send(message);
      }
    }
  }
}
