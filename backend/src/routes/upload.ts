import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';

export function registerUploadRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // POST /api/upload/pet-photo - Upload pet photo
  app.fastify.post(
    '/api/upload/pet-photo',
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ): Promise<any | void> => {
      app.logger.info(
        {
          method: request.method,
          path: request.url,
          contentType: request.headers['content-type'],
          isMultipart: request.isMultipart(),
        },
        'Pet photo upload started'
      );
      const session = await requireAuth(request, reply);
      if (!session) return;

      app.logger.info(
        { userId: session.user.id },
        'User authenticated for pet photo upload'
      );

      try {
        // Get file from 'image' field with size limit (10MB)
        const data = await request.file({ limits: { fileSize: 10 * 1024 * 1024 } });

        if (!data) {
          app.logger.warn(
            { userId: session.user.id },
            'No image file provided in upload'
          );
          return reply.status(400).send({ error: 'No image file provided' });
        }

        app.logger.info(
          { userId: session.user.id, filename: data.filename, encoding: data.encoding, mimetype: data.mimetype },
          'Received multipart file'
        );

        let buffer: Buffer;
        try {
          buffer = await data.toBuffer();
          app.logger.info(
            { userId: session.user.id, bufferSize: buffer.length, filename: data.filename },
            'File converted to buffer'
          );
        } catch (err) {
          app.logger.error(
            { err, userId: session.user.id, filename: data.filename },
            'Failed to convert file to buffer (may be too large)'
          );
          return reply.status(413).send({ error: 'File too large' });
        }

        // Generate a unique filename
        const timestamp = Date.now();
        const filename = `${timestamp}-${data.filename}`;
        const storageKey = `pet-photos/${session.user.id}/${filename}`;

        // Upload file to storage
        const uploadedKey = await app.storage.upload(storageKey, buffer);

        app.logger.info(
          { key: uploadedKey, filename, userId: session.user.id },
          'File uploaded to storage'
        );

        // Generate signed URL for client access
        const { url } = await app.storage.getSignedUrl(uploadedKey);

        app.logger.info(
          {
            key: uploadedKey,
            filename,
            userId: session.user.id,
          },
          'Pet photo uploaded successfully'
        );

        return {
          url,
          filename: data.filename,
          key: uploadedKey,
        };
      } catch (error) {
        app.logger.error(
          { err: error, userId: session.user.id },
          'Failed to upload pet photo'
        );
        throw error;
      }
    }
  );
}
