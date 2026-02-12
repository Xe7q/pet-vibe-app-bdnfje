import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, desc } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import { broadcastMatchNotification } from './matches.js';

export function registerSwipeRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // POST /api/swipes - Records swipe, checks for mutual match
  app.fastify.post(
    '/api/swipes',
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ): Promise<any | void> => {
      app.logger.info(
        { body: request.body },
        'Recording swipe'
      );
      const session = await requireAuth(request, reply);
      if (!session) return;

      try {
        const { swipedPetId, swipeType } = request.body as {
          swipedPetId: string;
          swipeType: 'like' | 'pass';
        };

        // Get the pet being swiped
        const swipedPet = await app.db.query.petProfiles.findFirst({
          where: eq(schema.petProfiles.id, swipedPetId as any),
        });

        if (!swipedPet) {
          app.logger.warn({ petId: swipedPetId }, 'Pet not found');
          return reply.status(404).send({ error: 'Pet not found' });
        }

        // Prevent swiping on own pet
        if (swipedPet.ownerId === session.user.id) {
          app.logger.warn(
            { userId: session.user.id, petId: swipedPetId },
            'User attempted to swipe on own pet'
          );
          return reply.status(400).send({ error: 'Cannot swipe on own pet' });
        }

        // Record the swipe
        const [swipe] = await app.db
          .insert(schema.swipes)
          .values({
            swiperId: session.user.id,
            swipedPetId: swipedPetId as any,
            swipeType,
          })
          .onConflictDoNothing()
          .returning();

        if (!swipe) {
          app.logger.warn(
            { userId: session.user.id, petId: swipedPetId },
            'Swipe already exists'
          );
          return reply.status(400).send({ error: 'Already swiped on this pet' });
        }

        // If it's a like, increment likes count
        if (swipeType === 'like') {
          await app.db
            .update(schema.petProfiles)
            .set({ likesCount: swipedPet.likesCount + 1 })
            .where(eq(schema.petProfiles.id, swipedPetId as any));

          app.logger.info(
            { swipeId: swipe.id, petId: swipedPetId },
            'Likes count incremented'
          );
        }

        // Check for mutual match (both users liked each other's pets)
        let matchCreated = null;
        if (swipeType === 'like') {
          // Check if the other user liked the current user's pet
          const userPet = await app.db.query.petProfiles.findFirst({
            where: eq(schema.petProfiles.ownerId, session.user.id),
          });

          if (userPet) {
            const mutualLike = await app.db.query.swipes.findFirst({
              where: and(
                eq(schema.swipes.swiperId, swipedPet.ownerId),
                eq(schema.swipes.swipedPetId, userPet.id),
                eq(schema.swipes.swipeType, 'like')
              ),
            });

            if (mutualLike) {
              // Create match
              const [newMatch] = await app.db
                .insert(schema.matches)
                .values({
                  user1Id: session.user.id,
                  user2Id: swipedPet.ownerId,
                  pet1Id: userPet.id,
                  pet2Id: swipedPet.id,
                })
                .onConflictDoNothing()
                .returning();

              if (newMatch) {
                matchCreated = newMatch;
                app.logger.info(
                  {
                    matchId: newMatch.id,
                    user1: session.user.id,
                    user2: swipedPet.ownerId,
                  },
                  'Match created from mutual like'
                );

                // Broadcast match notification via WebSocket
                broadcastMatchNotification({
                  matchId: newMatch.id,
                  user1Id: session.user.id,
                  user2Id: swipedPet.ownerId,
                  pet1Name: userPet.name,
                  pet2Name: swipedPet.name,
                  pet1Photo: userPet.photoUrl,
                  pet2Photo: swipedPet.photoUrl,
                });
              }
            }
          }
        }

        app.logger.info(
          {
            swipeId: swipe.id,
            userId: session.user.id,
            petId: swipedPetId,
            swipeType,
            matchCreated: !!matchCreated,
          },
          'Swipe recorded successfully'
        );

        const response: any = { success: true };
        if (matchCreated) {
          response.match = {
            matchId: matchCreated.id,
            otherPet: {
              id: swipedPet.id,
              name: swipedPet.name,
              breed: swipedPet.breed,
              photoUrl: swipedPet.photoUrl,
            },
          };
        }
        return response;
      } catch (error) {
        app.logger.error(
          {
            err: error,
            body: request.body,
            userId: session.user.id,
          },
          'Failed to record swipe'
        );
        throw error;
      }
    }
  );

  // GET /api/swipes/history - Returns user's swipe history
  app.fastify.get(
    '/api/swipes/history',
    async (request: FastifyRequest, reply: FastifyReply): Promise<any> => {
      app.logger.info(
        { userId: (request as any).user?.id },
        'Fetching swipe history'
      );
      const session = await requireAuth(request, reply);
      if (!session) return;

      try {
        const swipeHistory = await app.db.query.swipes.findMany({
          where: eq(schema.swipes.swiperId, session.user.id),
          with: {
            swipedPet: true,
          },
          orderBy: desc(schema.swipes.createdAt),
        });

        app.logger.info(
          { userId: session.user.id, count: swipeHistory.length },
          'Successfully fetched swipe history'
        );

        return swipeHistory.map((s) => ({
          id: s.id,
          swipedPet: {
            id: s.swipedPet.id,
            name: s.swipedPet.name,
            breed: s.swipedPet.breed,
            photoUrl: s.swipedPet.photoUrl,
          },
          swipeType: s.swipeType,
          createdAt: s.createdAt,
        }));
      } catch (error) {
        app.logger.error(
          { err: error, userId: session.user.id },
          'Failed to fetch swipe history'
        );
        throw error;
      }
    }
  );
}
