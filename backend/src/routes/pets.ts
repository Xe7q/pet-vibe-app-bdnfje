import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, desc } from 'drizzle-orm';
import * as schema from '../db/schema.js';

export function registerPetRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // GET /api/pets - Returns all pet profiles for discovery feed
  app.fastify.get(
    '/api/pets',
    async (request: FastifyRequest, reply: FastifyReply): Promise<any> => {
      app.logger.info(
        { method: request.method, path: request.url },
        'Fetching all pet profiles for discovery feed'
      );
      try {
        const pets = await app.db.select().from(schema.petProfiles);
        app.logger.info(
          { count: pets.length },
          'Successfully fetched pet profiles'
        );
        return pets.map((pet) => ({
          id: pet.id,
          ownerId: pet.ownerId,
          name: pet.name,
          breed: pet.breed,
          age: pet.age,
          bio: pet.bio,
          photoUrl: pet.photoUrl,
          likesCount: pet.likesCount,
        }));
      } catch (error) {
        app.logger.error(
          { err: error },
          'Failed to fetch pet profiles'
        );
        throw error;
      }
    }
  );

  // GET /api/pets/my-pet - Returns current user's pet profile
  app.fastify.get(
    '/api/pets/my-pet',
    async (request: FastifyRequest, reply: FastifyReply): Promise<any> => {
      app.logger.info(
        { method: request.method, path: request.url },
        'Fetching current user pet profile'
      );
      const session = await requireAuth(request, reply);
      if (!session) return;

      try {
        const pet = await app.db.query.petProfiles.findFirst({
          where: eq(schema.petProfiles.ownerId, session.user.id),
        });
        if (!pet) {
          app.logger.info(
            { userId: session.user.id },
            'User has no pet profile'
          );
          return null;
        }
        app.logger.info(
          { petId: pet.id, userId: session.user.id },
          'Successfully fetched user pet profile'
        );
        return {
          id: pet.id,
          ownerId: pet.ownerId,
          name: pet.name,
          breed: pet.breed,
          age: pet.age,
          bio: pet.bio,
          photoUrl: pet.photoUrl,
          likesCount: pet.likesCount,
        };
      } catch (error) {
        app.logger.error(
          { err: error, userId: session.user.id },
          'Failed to fetch user pet profile'
        );
        throw error;
      }
    }
  );

  // POST /api/pets - Creates pet profile for current user
  app.fastify.post(
    '/api/pets',
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ): Promise<any | void> => {
      app.logger.info(
        { body: request.body },
        'Creating pet profile'
      );
      const session = await requireAuth(request, reply);
      if (!session) return;

      try {
        const { name, breed, age, bio, photoUrl } = request.body as {
          name: string;
          breed: string;
          age: number;
          bio?: string;
          photoUrl: string;
        };

        const [newPet] = await app.db
          .insert(schema.petProfiles)
          .values({
            ownerId: session.user.id,
            name,
            breed,
            age,
            bio,
            photoUrl,
          })
          .returning();

        app.logger.info(
          { petId: newPet.id, userId: session.user.id },
          'Pet profile created successfully'
        );

        return {
          id: newPet.id,
          ownerId: newPet.ownerId,
          name: newPet.name,
          breed: newPet.breed,
          age: newPet.age,
          bio: newPet.bio,
          photoUrl: newPet.photoUrl,
          likesCount: newPet.likesCount,
        };
      } catch (error) {
        app.logger.error(
          { err: error, body: request.body, userId: session.user.id },
          'Failed to create pet profile'
        );
        throw error;
      }
    }
  );

  // PUT /api/pets/:id - Updates pet profile
  app.fastify.put(
    '/api/pets/:id',
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ): Promise<any | void> => {
      const { id } = request.params as { id: string };
      app.logger.info(
        { petId: id, body: request.body },
        'Updating pet profile'
      );
      const session = await requireAuth(request, reply);
      if (!session) return;

      try {
        const { name, breed, age, bio, photoUrl } = request.body as {
          name?: string;
          breed?: string;
          age?: number;
          bio?: string;
          photoUrl?: string;
        };

        // Check ownership
        const existingPet = await app.db.query.petProfiles.findFirst({
          where: eq(schema.petProfiles.id, id as any),
        });

        if (!existingPet) {
          app.logger.warn({ petId: id }, 'Pet profile not found');
          return reply.status(404).send({ error: 'Pet not found' });
        }

        if (existingPet.ownerId !== session.user.id) {
          app.logger.warn(
            { petId: id, userId: session.user.id, ownerId: existingPet.ownerId },
            'Unauthorized pet profile update attempt'
          );
          return reply.status(403).send({ error: 'Not authorized' });
        }

        const updates: any = {};
        if (name !== undefined) updates.name = name;
        if (breed !== undefined) updates.breed = breed;
        if (age !== undefined) updates.age = age;
        if (bio !== undefined) updates.bio = bio;
        if (photoUrl !== undefined) updates.photoUrl = photoUrl;

        const [updatedPet] = await app.db
          .update(schema.petProfiles)
          .set(updates)
          .where(eq(schema.petProfiles.id, id as any))
          .returning();

        app.logger.info(
          { petId: id, userId: session.user.id },
          'Pet profile updated successfully'
        );

        return {
          id: updatedPet.id,
          ownerId: updatedPet.ownerId,
          name: updatedPet.name,
          breed: updatedPet.breed,
          age: updatedPet.age,
          bio: updatedPet.bio,
          photoUrl: updatedPet.photoUrl,
          likesCount: updatedPet.likesCount,
        };
      } catch (error) {
        app.logger.error(
          { err: error, petId: id, userId: session.user.id },
          'Failed to update pet profile'
        );
        throw error;
      }
    }
  );

  // DELETE /api/pets/:id - Deletes pet profile
  app.fastify.delete(
    '/api/pets/:id',
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ): Promise<any | void> => {
      const { id } = request.params as { id: string };
      app.logger.info(
        { petId: id },
        'Deleting pet profile'
      );
      const session = await requireAuth(request, reply);
      if (!session) return;

      try {

        // Check ownership
        const existingPet = await app.db.query.petProfiles.findFirst({
          where: eq(schema.petProfiles.id, id as any),
        });

        if (!existingPet) {
          app.logger.warn({ petId: id }, 'Pet profile not found');
          return reply.status(404).send({ error: 'Pet not found' });
        }

        if (existingPet.ownerId !== session.user.id) {
          app.logger.warn(
            { petId: id, userId: session.user.id, ownerId: existingPet.ownerId },
            'Unauthorized pet profile deletion attempt'
          );
          return reply.status(403).send({ error: 'Not authorized' });
        }

        await app.db
          .delete(schema.petProfiles)
          .where(eq(schema.petProfiles.id, id as any));

        app.logger.info(
          { petId: id, userId: session.user.id },
          'Pet profile deleted successfully'
        );

        return { success: true };
      } catch (error) {
        app.logger.error(
          { err: error, petId: id, userId: session.user.id },
          'Failed to delete pet profile'
        );
        throw error;
      }
    }
  );

  // GET /api/leaderboard - Returns top 100 pets by likes_count
  app.fastify.get(
    '/api/leaderboard',
    async (request: FastifyRequest, reply: FastifyReply): Promise<any> => {
      app.logger.info(
        { method: request.method, path: request.url },
        'Fetching leaderboard'
      );
      try {
        const topPets = await app.db
          .select()
          .from(schema.petProfiles)
          .orderBy(desc(schema.petProfiles.likesCount))
          .limit(100);

        app.logger.info(
          { count: topPets.length },
          'Successfully fetched leaderboard'
        );

        return topPets.map((pet, index) => ({
          rank: index + 1,
          pet: {
            id: pet.id,
            name: pet.name,
            breed: pet.breed,
            photoUrl: pet.photoUrl,
            likesCount: pet.likesCount,
            owner: {
              id: pet.ownerId,
            },
          },
        }));
      } catch (error) {
        app.logger.error(
          { err: error },
          'Failed to fetch leaderboard'
        );
        throw error;
      }
    }
  );
}
