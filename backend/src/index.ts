import { createApplication } from "@specific-dev/framework";
import * as appSchema from './db/schema.js';
import * as authSchema from './db/auth-schema.js';
import { registerPetRoutes } from './routes/pets.js';
import { registerSwipeRoutes } from './routes/swipes.js';
import { registerMatchRoutes } from './routes/matches.js';
import { registerGiftRoutes } from './routes/gifts.js';
import { registerUploadRoutes } from './routes/upload.js';

// Combine schemas
const schema = { ...appSchema, ...authSchema };

// Create application with schema for full database type support
export const app = await createApplication(schema);

// Export App type for use in route files
export type App = typeof app;

// Set up authentication
app.withAuth();

// Set up storage for file uploads
app.withStorage();

// Register routes - add your route modules here
// IMPORTANT: Always use registration functions to avoid circular dependency issues
registerPetRoutes(app);
registerSwipeRoutes(app);
registerMatchRoutes(app);
registerGiftRoutes(app);
registerUploadRoutes(app);

await app.run();
app.logger.info('Application running');
