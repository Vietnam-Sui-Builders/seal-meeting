import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateToken } from '../index';
import { config } from '../config';

const router = Router();

// GET /api/rooms - Get all rooms by wallet address (no auth required for listing)
router.get('/', async (req: Request, res: Response) => {
  try {
    const { walletAddress } = req.query;

    if (!walletAddress || typeof walletAddress !== 'string') {
      return res.status(400).json({ error: 'Wallet address query parameter is required' });
    }

    // Find wallet by address
    const wallet = await prisma.wallet.findUnique({
      where: { address: walletAddress },
    });

    if (!wallet) {
      return res.json({ rooms: [] });
    }

    // Find all rooms owned by this wallet
    const rooms = await prisma.room.findMany({
      where: {
        ownerWalletId: wallet.id,
      },
      include: {
        memberships: {
          where: { status: 'active' },
        },
        approvals: {
          where: { status: 'pending' },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json({
      rooms: rooms.map(room => ({
        id: room.id,
        onchainObjectId: room.onchainObjectId,
        title: room.title,
        description: room.description,
        maxParticipants: room.maxParticipants,
        requireApproval: room.requireApproval,
        status: room.status,
        hostCapId: room.hostCapId,
        attendanceCount: room.attendanceCount,
        memberCount: room.memberships.length,
        pendingApprovals: room.approvals.length,
        createdAt: room.createdAt,
        startTime: room.startTime,
        endTime: room.endTime,
      })),
    });
  } catch (error) {
    console.error('Error fetching rooms:', error);
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

// Room creation doesn't require JWT - wallet address is provided directly
// Other routes still require authentication
router.post('/', async (req: Request, res: Response) => {
  try {
    const { 
      title, 
      description, 
      maxParticipants, 
      initialParticipants, 
      requireApproval = true, 
      walletAddress, 
      onchainObjectId,
      hostCapId 
    } = req.body;
    
    if (!walletAddress) {
      return res.status(400).json({ error: 'Wallet address is required' });
    }

    if (!onchainObjectId) {
      return res.status(400).json({ error: 'On-chain object ID is required' });
    }

    if (!title || !Array.isArray(initialParticipants)) {
      return res.status(400).json({ error: 'Title and initial participants are required' });
    }

    // Validate maxParticipants
    const maxParticipantsNum = maxParticipants ? parseInt(maxParticipants) : 20;
    if (isNaN(maxParticipantsNum) || maxParticipantsNum < 1 || maxParticipantsNum > 20) {
      return res.status(400).json({ error: 'Max participants must be between 1 and 20' });
    }

    // Find or create user and wallet (no JWT required - wallet address is proof)
    let user = await prisma.user.findFirst({
      where: { primaryWalletAddress: walletAddress },
    });

    if (!user) {
      user = await prisma.user.create({
        data: { primaryWalletAddress: walletAddress },
      });
    }

    // Find or create wallet
    let wallet = await prisma.wallet.findUnique({
      where: { address: walletAddress },
    });

    if (!wallet) {
      wallet = await prisma.wallet.create({
        data: {
          userId: user.id,
          address: walletAddress,
          type: 'sui',
        },
      });
    }

    // Create room record with on-chain object ID from the transaction
    const room = await prisma.room.create({
      data: {
        onchainObjectId: onchainObjectId,
        ownerUserId: user.id,
        ownerWalletId: wallet.id,
        title,
        description: description || null,
        maxParticipants: maxParticipantsNum,
        requireApproval,
        hostCapId: hostCapId || null, // HostCap object ID for managing the room
        status: 'scheduled', // New rooms start as scheduled
        sealPolicyId: null, // Can be extracted from on-chain object if needed
        attendanceCount: initialParticipants.length,
      },
    });

    // Create memberships
    const memberships = await Promise.all(
      initialParticipants.map((address: string) =>
        prisma.roomMembership.create({
          data: {
            roomId: room.id,
            walletAddress: address,
            role: address === walletAddress ? 'host' : 'guest',
            status: 'active',
          },
        })
      )
    );

    res.json({
      room: {
        id: room.id,
        onchainObjectId: room.onchainObjectId,
        title: room.title,
        description: room.description,
        maxParticipants: room.maxParticipants,
        requireApproval: room.requireApproval,
        status: room.status,
        hostCapId: room.hostCapId,
        createdAt: room.createdAt,
      },
      memberships: memberships.length,
    });
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// Other routes require authentication
router.use(authenticateToken);

/**
 * GET /api/rooms/:roomId
 * Get room details
 */
router.get('/:roomId', async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;

    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        ownerUser: true,
        ownerWallet: true,
        memberships: true,
        approvals: {
          where: { status: 'pending' },
        },
      },
    });

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    res.json({
      room: {
        id: room.id,
        onchainObjectId: room.onchainObjectId,
        title: room.title,
        description: room.description,
        maxParticipants: room.maxParticipants,
        requireApproval: room.requireApproval,
        status: room.status,
        hostCapId: room.hostCapId,
        sealPolicyId: room.sealPolicyId,
        startTime: room.startTime,
        endTime: room.endTime,
        attendanceCount: room.attendanceCount,
        createdAt: room.createdAt,
      },
      owner: {
        walletAddress: room.ownerWallet.address,
      },
      memberships: room.memberships.length,
      pendingApprovals: room.approvals.length,
    });
  } catch (error) {
    console.error('Error fetching room:', error);
    res.status(500).json({ error: 'Failed to fetch room' });
  }
});

/**
 * POST /api/rooms/:roomId/approve
 * Approve a guest to join the room
 */
router.post('/:roomId/approve', async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;
    const { guestAddress } = req.body;
    const walletAddress = req.user!.wal; // JWT payload contains 'wal' property (wallet address)

    if (!guestAddress) {
      return res.status(400).json({ error: 'Guest address is required' });
    }

    // Verify user is the room owner
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: { ownerWallet: true },
    });

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (room.ownerWallet.address !== walletAddress) {
      return res.status(403).json({ error: 'Only room owner can approve guests' });
    }

    // Create or update membership
    const membership = await prisma.roomMembership.upsert({
      where: {
        roomId_walletAddress: {
          roomId,
          walletAddress: guestAddress,
        },
      },
      update: {
        status: 'active',
        updatedAt: new Date(),
      },
      create: {
        roomId,
        walletAddress: guestAddress,
        role: 'guest',
        status: 'active',
      },
    });

    // Update approval request if exists
    await prisma.approvalRequest.updateMany({
      where: {
        roomId,
        requesterAddress: guestAddress,
        status: 'pending',
      },
      data: {
        status: 'approved',
        resolvedAt: new Date(),
        resolverAddress: walletAddress,
      },
    });

    // TODO: Update on-chain Seal policy via Sui transaction

    res.json({
      membership: {
        id: membership.id,
        walletAddress: membership.walletAddress,
        status: membership.status,
      },
    });
  } catch (error) {
    console.error('Error approving guest:', error);
    res.status(500).json({ error: 'Failed to approve guest' });
  }
});

export default router;

