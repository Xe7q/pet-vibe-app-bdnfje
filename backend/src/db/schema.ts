import {
  pgTable,
  text,
  uuid,
  integer,
  timestamp,
  uniqueIndex,
  index,
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
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('pet_profiles_owner_id_idx').on(table.ownerId),
    index('pet_profiles_likes_count_idx').on(table.likesCount),
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

// Relations
export const petProfilesRelations = relations(petProfiles, ({ many }) => ({
  swipes: many(swipes),
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
