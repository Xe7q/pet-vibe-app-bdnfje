import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema.js';

// Gift coin values
const GIFT_VALUES = {
  bone: 10,
  toy: 50,
  steak: 500,
};

export function registerGiftRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // POST /api/gifts - Send a gift
  app.fastify.post(
    '/api/gifts',
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ): Promise<any | void> => {
      app.logger.info(
        { body: request.body },
        'Sending gift'
      );
      const session = await requireAuth(request, reply);
      if (!session) return;

      try {
        const { receiverId, giftType } = request.body as {
          receiverId: string;
          giftType: 'bone' | 'toy' | 'steak';
        };

        // Validate gift type
        if (!GIFT_VALUES[giftType]) {
          app.logger.warn({ giftType }, 'Invalid gift type');
          return reply.status(400).send({ error: 'Invalid gift type' });
        }

        const coinCost = GIFT_VALUES[giftType];

        // Get sender's wallet
        let senderWallet = await app.db.query.userWallets.findFirst({
          where: eq(schema.userWallets.userId, session.user.id),
        });

        if (!senderWallet) {
          // Create wallet if doesn't exist
          [senderWallet] = await app.db
            .insert(schema.userWallets)
            .values({
              userId: session.user.id,
              balance: 100,
              totalEarned: 0,
            })
            .returning();
          app.logger.info(
            { userId: session.user.id },
            'Wallet created for user'
          );
        }

        // Check if sender has enough balance
        if (senderWallet.balance < coinCost) {
          app.logger.warn(
            { userId: session.user.id, balance: senderWallet.balance, cost: coinCost },
            'Insufficient balance'
          );
          return reply.status(400).send({ error: 'Insufficient balance' });
        }

        // Create gift record
        const [gift] = await app.db
          .insert(schema.gifts)
          .values({
            senderId: session.user.id,
            receiverId,
            giftType,
            coinValue: coinCost,
          })
          .returning();

        app.logger.info(
          { giftId: gift.id, senderId: session.user.id, receiverId },
          'Gift created'
        );

        // Update sender's balance (deduct)
        const newSenderBalance = senderWallet.balance - coinCost;
        await app.db
          .update(schema.userWallets)
          .set({
            balance: newSenderBalance,
            updatedAt: new Date(),
          })
          .where(eq(schema.userWallets.userId, session.user.id));

        app.logger.info(
          { userId: session.user.id, newBalance: newSenderBalance },
          'Sender balance updated'
        );

        // Get or create receiver's wallet
        let receiverWallet = await app.db.query.userWallets.findFirst({
          where: eq(schema.userWallets.userId, receiverId),
        });

        if (!receiverWallet) {
          [receiverWallet] = await app.db
            .insert(schema.userWallets)
            .values({
              userId: receiverId,
              balance: 100,
              totalEarned: 0,
            })
            .returning();
          app.logger.info(
            { userId: receiverId },
            'Wallet created for receiver'
          );
        }

        // Update receiver's wallet (add to totalEarned)
        const newReceiverEarned = receiverWallet.totalEarned + coinCost;
        await app.db
          .update(schema.userWallets)
          .set({
            totalEarned: newReceiverEarned,
            updatedAt: new Date(),
          })
          .where(eq(schema.userWallets.userId, receiverId));

        app.logger.info(
          {
            userId: receiverId,
            newTotalEarned: newReceiverEarned,
          },
          'Receiver total earned updated'
        );

        return {
          success: true,
          newBalance: newSenderBalance,
          gift: {
            id: gift.id,
            giftType,
            coinValue: coinCost,
          },
        };
      } catch (error) {
        app.logger.error(
          {
            err: error,
            body: request.body,
            userId: session.user.id,
          },
          'Failed to send gift'
        );
        throw error;
      }
    }
  );

  // GET /api/wallet - Get user's wallet
  app.fastify.get(
    '/api/wallet',
    async (request: FastifyRequest, reply: FastifyReply): Promise<any> => {
      app.logger.info(
        { userId: (request as any).user?.id },
        'Fetching user wallet'
      );
      const session = await requireAuth(request, reply);
      if (!session) return;

      try {
        let wallet = await app.db.query.userWallets.findFirst({
          where: eq(schema.userWallets.userId, session.user.id),
        });

        if (!wallet) {
          // Create wallet if doesn't exist
          [wallet] = await app.db
            .insert(schema.userWallets)
            .values({
              userId: session.user.id,
              balance: 100,
              totalEarned: 0,
            })
            .returning();
          app.logger.info(
            { userId: session.user.id },
            'Wallet created for user'
          );
        }

        app.logger.info(
          {
            userId: session.user.id,
            balance: wallet.balance,
            totalEarned: wallet.totalEarned,
          },
          'Successfully fetched user wallet'
        );

        return {
          balance: wallet.balance,
          totalEarned: wallet.totalEarned,
        };
      } catch (error) {
        app.logger.error(
          { err: error, userId: session.user.id },
          'Failed to fetch wallet'
        );
        throw error;
      }
    }
  );
}
