import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, desc } from 'drizzle-orm';
import * as schema from '../db/schema.js';

export function registerLiveRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // POST /api/live/start - Creates live stream for user's pet
  app.fastify.post(
    '/api/live/start',
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ): Promise<any | void> => {
      app.logger.info(
        { body: request.body },
        'Starting live stream'
      );
      const session = await requireAuth(request, reply);
      if (!session) return;

      try {
        const { petId, title } = request.body as {
          petId: string;
          title: string;
        };

        // Verify pet exists and belongs to user
        const pet = await app.db.query.petProfiles.findFirst({
          where: eq(schema.petProfiles.id, petId as any),
        });

        if (!pet) {
          app.logger.warn({ petId }, 'Pet not found');
          return reply.status(404).send({ error: 'Pet not found' });
        }

        if (pet.ownerId !== session.user.id) {
          app.logger.warn(
            { petId, userId: session.user.id, ownerId: pet.ownerId },
            'Unauthorized live stream start attempt'
          );
          return reply.status(403).send({ error: 'Not authorized' });
        }

        // Auto-cleanup: End any existing active streams for this pet
        const existingStream = await app.db.query.liveStreams.findFirst({
          where: and(
            eq(schema.liveStreams.petId, petId as any),
            eq(schema.liveStreams.isActive, true)
          ),
        });

        if (existingStream) {
          app.logger.info(
            { existingStreamId: existingStream.id, petId },
            'Ending existing active stream to start new one'
          );
          await app.db
            .update(schema.liveStreams)
            .set({
              isActive: false,
              endedAt: new Date(),
            })
            .where(eq(schema.liveStreams.id, existingStream.id));
          app.logger.info(
            { existingStreamId: existingStream.id, petId },
            'Existing stream ended'
          );
        }

        // Create live stream
        const [newStream] = await app.db
          .insert(schema.liveStreams)
          .values({
            petId: petId as any,
            ownerId: session.user.id,
            title,
          })
          .returning();

        app.logger.info(
          { streamId: newStream.id, petId, userId: session.user.id },
          'Live stream started successfully'
        );

        // Generate stream URL (in real implementation, this would be an actual stream URL)
        const streamUrl = `wss://stream.pawpaw.live/${newStream.id}`;

        return {
          streamId: newStream.id,
          streamUrl,
        };
      } catch (error) {
        app.logger.error(
          { err: error, body: request.body, userId: session.user.id },
          'Failed to start live stream'
        );
        throw error;
      }
    }
  );

  // POST /api/live/end/:streamId - Ends the live stream
  app.fastify.post(
    '/api/live/end/:streamId',
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ): Promise<any | void> => {
      const { streamId } = request.params as { streamId: string };
      app.logger.info(
        { streamId },
        'Ending live stream'
      );
      const session = await requireAuth(request, reply);
      if (!session) return;

      try {
        // Get the stream
        const stream = await app.db.query.liveStreams.findFirst({
          where: eq(schema.liveStreams.id, streamId as any),
        });

        if (!stream) {
          app.logger.warn({ streamId }, 'Live stream not found');
          return reply.status(404).send({ error: 'Stream not found' });
        }

        if (stream.ownerId !== session.user.id) {
          app.logger.warn(
            { streamId, userId: session.user.id, ownerId: stream.ownerId },
            'Unauthorized live stream end attempt'
          );
          return reply.status(403).send({ error: 'Not authorized' });
        }

        // End the stream
        await app.db
          .update(schema.liveStreams)
          .set({
            isActive: false,
            endedAt: new Date(),
          })
          .where(eq(schema.liveStreams.id, streamId as any));

        app.logger.info(
          { streamId, userId: session.user.id },
          'Live stream ended successfully'
        );

        return { success: true };
      } catch (error) {
        app.logger.error(
          { err: error, streamId, userId: session.user.id },
          'Failed to end live stream'
        );
        throw error;
      }
    }
  );

  // GET /api/live/active - Returns all active live streams
  app.fastify.get(
    '/api/live/active',
    async (request: FastifyRequest, reply: FastifyReply): Promise<any> => {
      app.logger.info(
        { method: request.method, path: request.url },
        'Fetching active live streams'
      );
      try {
        const activeStreams = await app.db.query.liveStreams.findMany({
          where: eq(schema.liveStreams.isActive, true),
          with: {
            pet: true,
          },
          orderBy: desc(schema.liveStreams.startedAt),
        });

        app.logger.info(
          { count: activeStreams.length },
          'Successfully fetched active live streams'
        );

        return activeStreams.map((stream) => ({
          id: stream.id,
          pet: {
            id: stream.pet.id,
            name: stream.pet.name,
            photoUrl: stream.pet.photoUrl,
          },
          ownerId: stream.ownerId,
          title: stream.title,
          viewerCount: stream.viewerCount,
          startedAt: stream.startedAt,
        }));
      } catch (error) {
        app.logger.error(
          { err: error },
          'Failed to fetch active live streams'
        );
        throw error;
      }
    }
  );

  // GET /api/live/:streamId - Returns live stream details
  app.fastify.get(
    '/api/live/:streamId',
    async (request: FastifyRequest, reply: FastifyReply): Promise<any | void> => {
      const { streamId } = request.params as { streamId: string };
      app.logger.info(
        { streamId },
        'Fetching live stream details'
      );
      try {
        const stream = await app.db.query.liveStreams.findFirst({
          where: eq(schema.liveStreams.id, streamId as any),
          with: {
            pet: true,
          },
        });

        if (!stream) {
          app.logger.warn({ streamId }, 'Live stream not found');
          return reply.status(404).send({ error: 'Stream not found' });
        }

        app.logger.info(
          { streamId },
          'Successfully fetched live stream details'
        );

        return {
          id: stream.id,
          pet: {
            id: stream.pet.id,
            name: stream.pet.name,
            photoUrl: stream.pet.photoUrl,
          },
          ownerId: stream.ownerId,
          title: stream.title,
          viewerCount: stream.viewerCount,
          startedAt: stream.startedAt,
        };
      } catch (error) {
        app.logger.error(
          { err: error, streamId },
          'Failed to fetch live stream details'
        );
        throw error;
      }
    }
  );

  // POST /api/live/:streamId/join - Increments viewer count
  app.fastify.post(
    '/api/live/:streamId/join',
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ): Promise<any | void> => {
      const { streamId } = request.params as { streamId: string };
      app.logger.info(
        { streamId },
        'User joining live stream'
      );
      const session = await requireAuth(request, reply);
      if (!session) return;

      try {
        const stream = await app.db.query.liveStreams.findFirst({
          where: eq(schema.liveStreams.id, streamId as any),
        });

        if (!stream) {
          app.logger.warn({ streamId }, 'Live stream not found');
          return reply.status(404).send({ error: 'Stream not found' });
        }

        if (!stream.isActive) {
          app.logger.warn({ streamId }, 'Stream is not active');
          return reply.status(400).send({ error: 'Stream is not active' });
        }

        // Increment viewer count
        await app.db
          .update(schema.liveStreams)
          .set({
            viewerCount: stream.viewerCount + 1,
          })
          .where(eq(schema.liveStreams.id, streamId as any));

        app.logger.info(
          { streamId, userId: session.user.id, newViewerCount: stream.viewerCount + 1 },
          'User joined live stream'
        );

        return { success: true };
      } catch (error) {
        app.logger.error(
          { err: error, streamId, userId: session.user.id },
          'Failed to join live stream'
        );
        throw error;
      }
    }
  );

  // POST /api/live/:streamId/leave - Decrements viewer count
  app.fastify.post(
    '/api/live/:streamId/leave',
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ): Promise<any | void> => {
      const { streamId } = request.params as { streamId: string };
      app.logger.info(
        { streamId },
        'User leaving live stream'
      );
      const session = await requireAuth(request, reply);
      if (!session) return;

      try {
        const stream = await app.db.query.liveStreams.findFirst({
          where: eq(schema.liveStreams.id, streamId as any),
        });

        if (!stream) {
          app.logger.warn({ streamId }, 'Live stream not found');
          return reply.status(404).send({ error: 'Stream not found' });
        }

        // Decrement viewer count (don't go below 0)
        const newViewerCount = Math.max(0, stream.viewerCount - 1);
        await app.db
          .update(schema.liveStreams)
          .set({
            viewerCount: newViewerCount,
          })
          .where(eq(schema.liveStreams.id, streamId as any));

        app.logger.info(
          { streamId, userId: session.user.id, newViewerCount },
          'User left live stream'
        );

        return { success: true };
      } catch (error) {
        app.logger.error(
          { err: error, streamId, userId: session.user.id },
          'Failed to leave live stream'
        );
        throw error;
      }
    }
  );
}
