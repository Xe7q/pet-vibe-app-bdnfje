import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, or, desc, sql } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import { broadcastChatMessage } from './realtime-chat.js';

export function registerChatRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // GET /api/conversations - Returns all conversations for authenticated user
  app.fastify.get(
    '/api/conversations',
    async (request: FastifyRequest, reply: FastifyReply): Promise<any> => {
      app.logger.info(
        { userId: (request as any).user?.id },
        'Fetching conversations'
      );
      const session = await requireAuth(request, reply);
      if (!session) return;

      try {
        // Get all matches for the user
        const userMatches = await app.db.query.matches.findMany({
          where: or(
            eq(schema.matches.user1Id, session.user.id),
            eq(schema.matches.user2Id, session.user.id)
          ),
          with: {
            pet1: true,
            pet2: true,
          },
        });

        app.logger.info(
          { userId: session.user.id, matchCount: userMatches.length },
          'Found user matches'
        );

        const conversations = await Promise.all(
          userMatches.map(async (match) => {
            // Get or create conversation
            let conversation = await app.db.query.conversations.findFirst({
              where: eq(schema.conversations.matchId, match.id),
            });

            if (!conversation) {
              [conversation] = await app.db
                .insert(schema.conversations)
                .values({
                  matchId: match.id,
                })
                .returning();
              app.logger.info(
                { conversationId: conversation.id, matchId: match.id },
                'Conversation created'
              );
            }

            // Determine other user and pet
            const isUser1 = match.user1Id === session.user.id;
            const otherUserId = isUser1 ? match.user2Id : match.user1Id;
            const otherPet = isUser1 ? match.pet2 : match.pet1;

            // Get last message
            const lastMsg = await app.db.query.messages.findFirst({
              where: eq(schema.messages.conversationId, conversation.id),
              orderBy: desc(schema.messages.createdAt),
            });

            // Count unread messages
            const unreadCount = await app.db
              .select({ count: sql`count(*)` })
              .from(schema.messages)
              .where(
                and(
                  eq(schema.messages.conversationId, conversation.id),
                  eq(schema.messages.isRead, false),
                  // Only count messages not sent by current user
                  sql`${schema.messages.senderId} != ${session.user.id}`
                )
              );

            return {
              id: conversation.id,
              matchId: match.id,
              otherUser: {
                id: otherUserId,
              },
              otherPet: {
                id: otherPet.id,
                name: otherPet.name,
                photoUrl: otherPet.photoUrl,
              },
              lastMessage: lastMsg
                ? {
                    content: lastMsg.content,
                    imageUrl: lastMsg.imageUrl,
                    createdAt: lastMsg.createdAt,
                    senderId: lastMsg.senderId,
                  }
                : null,
              unreadCount: Number(unreadCount[0]?.count || 0),
              createdAt: conversation.createdAt,
              updatedAt: conversation.updatedAt,
            };
          })
        );

        // Sort by updatedAt descending
        conversations.sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );

        app.logger.info(
          { userId: session.user.id, count: conversations.length },
          'Successfully fetched conversations'
        );

        return conversations;
      } catch (error) {
        app.logger.error(
          { err: error, userId: session.user.id },
          'Failed to fetch conversations'
        );
        throw error;
      }
    }
  );

  // GET /api/conversations/:matchId - Get or create conversation for a match
  app.fastify.get(
    '/api/conversations/:matchId',
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ): Promise<any | void> => {
      const { matchId } = request.params as { matchId: string };
      app.logger.info(
        { matchId },
        'Getting or creating conversation'
      );
      const session = await requireAuth(request, reply);
      if (!session) return;

      try {
        // Verify user is part of the match
        const match = await app.db.query.matches.findFirst({
          where: eq(schema.matches.id, matchId as any),
          with: {
            pet1: true,
            pet2: true,
          },
        });

        if (!match) {
          app.logger.warn({ matchId }, 'Match not found');
          return reply.status(404).send({ error: 'Match not found' });
        }

        const isUser1 = match.user1Id === session.user.id;
        const isUser2 = match.user2Id === session.user.id;

        if (!isUser1 && !isUser2) {
          app.logger.warn(
            { matchId, userId: session.user.id },
            'User not part of match'
          );
          return reply.status(403).send({ error: 'Not authorized' });
        }

        // Get or create conversation
        let conversation = await app.db.query.conversations.findFirst({
          where: eq(schema.conversations.matchId, matchId as any),
        });

        if (!conversation) {
          [conversation] = await app.db
            .insert(schema.conversations)
            .values({
              matchId: matchId as any,
            })
            .returning();
          app.logger.info(
            { conversationId: conversation.id, matchId },
            'Conversation created'
          );
        }

        const otherUserId = isUser1 ? match.user2Id : match.user1Id;
        const otherPet = isUser1 ? match.pet2 : match.pet1;

        app.logger.info(
          { conversationId: conversation.id, matchId, userId: session.user.id },
          'Successfully got or created conversation'
        );

        return {
          id: conversation.id,
          matchId: match.id,
          otherUser: {
            id: otherUserId,
          },
          otherPet: {
            id: otherPet.id,
            name: otherPet.name,
            photoUrl: otherPet.photoUrl,
          },
          createdAt: conversation.createdAt,
        };
      } catch (error) {
        app.logger.error(
          { err: error, matchId, userId: session.user.id },
          'Failed to get or create conversation'
        );
        throw error;
      }
    }
  );

  // GET /api/conversations/:conversationId/messages - Get all messages in conversation
  app.fastify.get(
    '/api/conversations/:conversationId/messages',
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ): Promise<any | void> => {
      const { conversationId } = request.params as { conversationId: string };
      app.logger.info(
        { conversationId },
        'Fetching messages'
      );
      const session = await requireAuth(request, reply);
      if (!session) return;

      try {
        // Get conversation and verify user is part of match
        const conversation = await app.db.query.conversations.findFirst({
          where: eq(schema.conversations.id, conversationId as any),
        });

        if (!conversation) {
          app.logger.warn({ conversationId }, 'Conversation not found');
          return reply.status(404).send({ error: 'Conversation not found' });
        }

        const match = await app.db.query.matches.findFirst({
          where: eq(schema.matches.id, conversation.matchId as any),
        });

        if (!match) {
          app.logger.warn({ matchId: conversation.matchId }, 'Match not found');
          return reply.status(404).send({ error: 'Match not found' });
        }

        const isUser1 = match.user1Id === session.user.id;
        const isUser2 = match.user2Id === session.user.id;

        if (!isUser1 && !isUser2) {
          app.logger.warn(
            { conversationId, userId: session.user.id },
            'User not part of match'
          );
          return reply.status(403).send({ error: 'Not authorized' });
        }

        // Get all messages
        const messageList = await app.db.query.messages.findMany({
          where: eq(schema.messages.conversationId, conversationId as any),
          orderBy: schema.messages.createdAt,
        });

        app.logger.info(
          { conversationId, userId: session.user.id, count: messageList.length },
          'Successfully fetched messages'
        );

        return messageList.map((msg) => ({
          id: msg.id,
          senderId: msg.senderId,
          content: msg.content,
          imageUrl: msg.imageUrl,
          isRead: msg.isRead,
          createdAt: msg.createdAt,
        }));
      } catch (error) {
        app.logger.error(
          { err: error, conversationId, userId: session.user.id },
          'Failed to fetch messages'
        );
        throw error;
      }
    }
  );

  // POST /api/conversations/:conversationId/messages - Send a message
  app.fastify.post(
    '/api/conversations/:conversationId/messages',
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ): Promise<any | void> => {
      const { conversationId } = request.params as { conversationId: string };
      app.logger.info(
        { conversationId, body: request.body },
        'Sending message'
      );
      const session = await requireAuth(request, reply);
      if (!session) return;

      try {
        const { content, imageUrl } = request.body as {
          content?: string;
          imageUrl?: string;
        };

        // Validate at least one of content or imageUrl is provided
        if (!content && !imageUrl) {
          app.logger.warn(
            { conversationId, userId: session.user.id },
            'Message must have content or imageUrl'
          );
          return reply
            .status(400)
            .send({ error: 'Message must have content or imageUrl' });
        }

        // Get conversation and verify user is part of match
        const conversation = await app.db.query.conversations.findFirst({
          where: eq(schema.conversations.id, conversationId as any),
        });

        if (!conversation) {
          app.logger.warn({ conversationId }, 'Conversation not found');
          return reply.status(404).send({ error: 'Conversation not found' });
        }

        const match = await app.db.query.matches.findFirst({
          where: eq(schema.matches.id, conversation.matchId as any),
        });

        if (!match) {
          app.logger.warn({ matchId: conversation.matchId }, 'Match not found');
          return reply.status(404).send({ error: 'Match not found' });
        }

        const isUser1 = match.user1Id === session.user.id;
        const isUser2 = match.user2Id === session.user.id;

        if (!isUser1 && !isUser2) {
          app.logger.warn(
            { conversationId, userId: session.user.id },
            'User not part of match'
          );
          return reply.status(403).send({ error: 'Not authorized' });
        }

        // Create message
        const [newMessage] = await app.db
          .insert(schema.messages)
          .values({
            conversationId: conversationId as any,
            senderId: session.user.id,
            content: content || null,
            imageUrl: imageUrl || null,
          })
          .returning();

        // Update conversation updatedAt
        await app.db
          .update(schema.conversations)
          .set({
            updatedAt: new Date(),
          })
          .where(eq(schema.conversations.id, conversationId as any));

        app.logger.info(
          {
            messageId: newMessage.id,
            conversationId,
            userId: session.user.id,
          },
          'Message sent successfully'
        );

        // Broadcast via WebSocket to other user
        const otherUserId = isUser1 ? match.user2Id : match.user1Id;
        broadcastChatMessage({
          messageId: newMessage.id,
          conversationId,
          senderId: session.user.id,
          otherUserId,
          content: newMessage.content,
          imageUrl: newMessage.imageUrl,
          createdAt: newMessage.createdAt,
        });

        return {
          id: newMessage.id,
          senderId: newMessage.senderId,
          content: newMessage.content,
          imageUrl: newMessage.imageUrl,
          isRead: newMessage.isRead,
          createdAt: newMessage.createdAt,
        };
      } catch (error) {
        app.logger.error(
          {
            err: error,
            conversationId,
            body: request.body,
            userId: session.user.id,
          },
          'Failed to send message'
        );
        throw error;
      }
    }
  );

  // POST /api/conversations/:conversationId/mark-read - Mark messages as read
  app.fastify.post(
    '/api/conversations/:conversationId/mark-read',
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ): Promise<any | void> => {
      const { conversationId } = request.params as { conversationId: string };
      app.logger.info(
        { conversationId },
        'Marking messages as read'
      );
      const session = await requireAuth(request, reply);
      if (!session) return;

      try {
        // Get conversation and verify user is part of match
        const conversation = await app.db.query.conversations.findFirst({
          where: eq(schema.conversations.id, conversationId as any),
        });

        if (!conversation) {
          app.logger.warn({ conversationId }, 'Conversation not found');
          return reply.status(404).send({ error: 'Conversation not found' });
        }

        const match = await app.db.query.matches.findFirst({
          where: eq(schema.matches.id, conversation.matchId as any),
        });

        if (!match) {
          app.logger.warn({ matchId: conversation.matchId }, 'Match not found');
          return reply.status(404).send({ error: 'Match not found' });
        }

        const isUser1 = match.user1Id === session.user.id;
        const isUser2 = match.user2Id === session.user.id;

        if (!isUser1 && !isUser2) {
          app.logger.warn(
            { conversationId, userId: session.user.id },
            'User not part of match'
          );
          return reply.status(403).send({ error: 'Not authorized' });
        }

        // Count unread messages before marking them as read
        const unreadMessages = await app.db
          .select({ count: sql`count(*)` })
          .from(schema.messages)
          .where(
            and(
              eq(schema.messages.conversationId, conversationId as any),
              eq(schema.messages.isRead, false),
              sql`${schema.messages.senderId} != ${session.user.id}`
            )
          );

        const markedCount = Number(unreadMessages[0]?.count || 0);

        // Mark messages as read (only messages not sent by current user)
        await app.db
          .update(schema.messages)
          .set({ isRead: true })
          .where(
            and(
              eq(schema.messages.conversationId, conversationId as any),
              sql`${schema.messages.senderId} != ${session.user.id}`
            )
          );

        app.logger.info(
          {
            conversationId,
            userId: session.user.id,
            markedCount,
          },
          'Messages marked as read'
        );

        return { success: true, markedCount };
      } catch (error) {
        app.logger.error(
          { err: error, conversationId, userId: session.user.id },
          'Failed to mark messages as read'
        );
        throw error;
      }
    }
  );
}
