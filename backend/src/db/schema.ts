import {
  pgTable,
  text,
  uuid,
  integer,
  timestamp,
  uniqueIndex,
  index,
  boolean,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Pet Profiles table
export const petProfiles = pgTable(
  'pet_profiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: text('owner_id').notNull(), // references auth user
    name: text('name').notNull(),
    breed: text('breed').notNull(),
    age: integer('age').notNull(),
    bio: text('bio'),
    photoUrl: text('photo_url').notNull(),
    likesCount: integer('likes_count').default(0).notNull(),
    isFeatured: boolean('is_featured').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('pet_profiles_owner_id_idx').on(table.ownerId),
    index('pet_profiles_likes_count_idx').on(table.likesCount),
    index('pet_profiles_is_featured_idx').on(table.isFeatured),
  ]
);

// Swipes table
export const swipes = pgTable(
  'swipes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    swiperId: text('swiper_id').notNull(), // references auth user
    swipedPetId: uuid('swiped_pet_id')
      .notNull()
      .references(() => petProfiles.id, { onDelete: 'cascade' }),
    swipeType: text('swipe_type', { enum: ['like', 'pass'] }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('swipes_swiper_pet_unique').on(
      table.swiperId,
      table.swipedPetId
    ),
    index('swipes_swiper_id_idx').on(table.swiperId),
    index('swipes_swiped_pet_id_idx').on(table.swipedPetId),
  ]
);

// Matches table
export const matches = pgTable(
  'matches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user1Id: text('user1_id').notNull(),
    user2Id: text('user2_id').notNull(),
    pet1Id: uuid('pet1_id')
      .notNull()
      .references(() => petProfiles.id, { onDelete: 'cascade' }),
    pet2Id: uuid('pet2_id')
      .notNull()
      .references(() => petProfiles.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('matches_users_unique').on(table.user1Id, table.user2Id),
    index('matches_user1_id_idx').on(table.user1Id),
    index('matches_user2_id_idx').on(table.user2Id),
  ]
);

// Gifts table
export const gifts = pgTable(
  'gifts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    senderId: text('sender_id').notNull(), // references auth user
    receiverId: text('receiver_id').notNull(), // references auth user
    giftType: text('gift_type', { enum: ['bone', 'toy', 'steak'] }).notNull(),
    coinValue: integer('coin_value').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('gifts_sender_id_idx').on(table.senderId),
    index('gifts_receiver_id_idx').on(table.receiverId),
  ]
);

// User Wallets table
export const userWallets = pgTable('user_wallets', {
  userId: text('user_id').primaryKey(), // references auth user
  balance: integer('balance').default(100).notNull(),
  totalEarned: integer('total_earned').default(0).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Live Streams table
export const liveStreams = pgTable(
  'live_streams',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    petId: uuid('pet_id')
      .notNull()
      .references(() => petProfiles.id, { onDelete: 'cascade' }),
    ownerId: text('owner_id').notNull(), // references auth user
    title: text('title'),
    viewerCount: integer('viewer_count').default(0).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    startedAt: timestamp('started_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
  },
  (table) => [
    index('live_streams_pet_id_idx').on(table.petId),
    index('live_streams_owner_id_idx').on(table.ownerId),
    index('live_streams_is_active_idx').on(table.isActive),
  ]
);

// Conversations table
export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    matchId: text('match_id').notNull(), // references matches.id
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('conversations_match_id_idx').on(table.matchId),
    uniqueIndex('conversations_match_id_unique').on(table.matchId),
  ]
);

// Messages table
export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    senderId: text('sender_id').notNull(), // references auth user
    content: text('content'),
    imageUrl: text('image_url'),
    isRead: boolean('is_read').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('messages_conversation_id_idx').on(table.conversationId),
    index('messages_sender_id_idx').on(table.senderId),
    index('messages_created_at_idx').on(table.createdAt),
  ]
);

// Relations
export const petProfilesRelations = relations(petProfiles, ({ many }) => ({
  swipes: many(swipes),
  liveStreams: many(liveStreams),
}));

export const swipesRelations = relations(swipes, ({ one }) => ({
  swipedPet: one(petProfiles, {
    fields: [swipes.swipedPetId],
    references: [petProfiles.id],
  }),
}));

export const matchesRelations = relations(matches, ({ one }) => ({
  pet1: one(petProfiles, {
    fields: [matches.pet1Id],
    references: [petProfiles.id],
  }),
  pet2: one(petProfiles, {
    fields: [matches.pet2Id],
    references: [petProfiles.id],
  }),
}));

export const liveStreamsRelations = relations(liveStreams, ({ one }) => ({
  pet: one(petProfiles, {
    fields: [liveStreams.petId],
    references: [petProfiles.id],
  }),
}));

export const conversationsRelations = relations(
  conversations,
  ({ many }) => ({
    messages: many(messages),
  })
);

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}));
