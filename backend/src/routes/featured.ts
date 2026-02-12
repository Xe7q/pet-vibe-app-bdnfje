import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema.js';

export function registerFeaturedRoutes(app: App) {
  // GET /api/featured-pets - Returns featured pets for stories section
  app.fastify.get(
    '/api/featured-pets',
    async (request: FastifyRequest, reply: FastifyReply): Promise<any> => {
      app.logger.info(
        { method: request.method, path: request.url },
        'Fetching featured pets'
      );
      try {
        const featuredPets = await app.db.query.petProfiles.findMany({
          where: eq(schema.petProfiles.isFeatured, true),
          with: {
            liveStreams: {
              where: eq(schema.liveStreams.isActive, true),
            },
          },
        });

        app.logger.info(
          { count: featuredPets.length },
          'Successfully fetched featured pets'
        );

        return featuredPets.map((pet) => ({
          id: pet.id,
          name: pet.name,
          photoUrl: pet.photoUrl,
          isLive: pet.liveStreams && pet.liveStreams.length > 0,
        }));
      } catch (error) {
        app.logger.error(
          { err: error },
          'Failed to fetch featured pets'
        );
        throw error;
      }
    }
  );
}
