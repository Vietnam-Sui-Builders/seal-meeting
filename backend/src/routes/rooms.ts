import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { authenticateToken } from "../index";

const router = Router();

// Helper to convert room status code to string
function getRoomStatus(statusCode: number): "scheduled" | "active" | "ended" {
  switch (statusCode) {
    case 1:
      return "scheduled";
    case 2:
      return "active";
    case 3:
      return "ended";
    default:
      return "scheduled";
  }
}

// Helper to convert Unix timestamp to Date
function unixToDate(timestamp: bigint | null): Date | null {
  if (!timestamp) return null;
  return new Date(Number(timestamp) * 1000);
}

// GET /api/rooms - Get all meeting rooms (indexed from blockchain)
router.get("/", async (req: Request, res: Response) => {
  try {
    const { walletAddress, status } = req.query;

    // Build filter
    const where: any = {};

    // Filter by host OR participant (if walletAddress provided)
    if (walletAddress && typeof walletAddress === "string") {
      // Get rooms where user is either:
      // 1. A host (in the hosts array), OR
      // 2. A participant (in the participants relation)
      where.OR = [
        {
          hosts: {
            has: walletAddress, // Check if walletAddress is in hosts array
          },
        },
        {
          participants: {
            some: {
              participantAddress: walletAddress,
            },
          },
        },
      ];
    }

    // Filter by status (1=scheduled, 2=active, 3=ended)
    try {
      if (status && typeof status === "string") {
        const statusMap: Record<string, number> = {
          scheduled: 1,
          active: 2,
          ended: 3,
        };
        if (statusMap[status] !== undefined) {
          where.status = statusMap[status];
        }
      }
    } catch (error) {
      throw new Error(error as string);
    }

    // Fetch meeting rooms from indexed data
    const meetingRooms = await prisma.meetingRoom.findMany({
      where,
      include: {
        participants: true,
        metadata: true,
        approvals: {
          where: { status: "pending" },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 100, // Limit for performance
    });

    res.json({
      rooms: meetingRooms.map((room) => {
        // Determine user's role in this room
        let userRole: "HOST" | "PARTICIPANT" | null = null;
        if (walletAddress && typeof walletAddress === "string") {
          // Check if user is in hosts array
          if (room.hosts.includes(walletAddress)) {
            userRole = "HOST";
          } else {
            // Check if user is in participants
            const participant = room.participants.find(
              (p) => p.participantAddress === walletAddress
            );
            if (participant) {
              userRole = participant.role as "HOST" | "PARTICIPANT";
            }
          }
        }

        return {
          roomId: room.roomId,
          title: room.title,
          hosts: room.hosts,
          status: getRoomStatus(room.status),
          maxParticipants: Number(room.maxParticipants),
          requireApproval: room.requireApproval,
          participantCount: room.participantCount,
          sealPolicyId: room.sealPolicyId,
          createdAt: unixToDate(room.createdAt),
          startedAt: unixToDate(room.startedAt),
          endedAt: unixToDate(room.endedAt),
          transactionDigest: room.transactionDigest,
          // Metadata
          language: room.metadata?.language,
          timezone: room.metadata?.timezone,
          recordingBlobId: room.metadata?.recordingBlobId?.toString(),
          // Backend data
          pendingApprovals: room.approvals.length,
          // User's role in this room
          userRole,
        };
      }),
    });
  } catch (error) {
    console.error("Error fetching rooms:", error);
    res.status(500).json({ error: "Failed to fetch rooms" });
  }
});

/**
 * GET /api/rooms/:roomId
 * Get room details by roomId (blockchain object ID)
 */
router.get("/:roomId", async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;

    const meetingRoom = await prisma.meetingRoom.findUnique({
      where: { roomId },
      include: {
        participants: {
          orderBy: {
            joinedAt: "desc",
          },
        },
        metadata: true,
        approvals: {
          where: { status: "pending" },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!meetingRoom) {
      return res.status(404).json({ error: "Room not found" });
    }

    // Separate hosts and participants
    const hosts = meetingRoom.participants.filter((p) => p.role === "HOST");
    const participants = meetingRoom.participants.filter(
      (p) => p.role === "PARTICIPANT"
    );

    res.json({
      room: {
        roomId: meetingRoom.roomId,
        title: meetingRoom.title,
        status: getRoomStatus(meetingRoom.status),
        maxParticipants: Number(meetingRoom.maxParticipants),
        requireApproval: meetingRoom.requireApproval,
        participantCount: meetingRoom.participantCount,
        sealPolicyId: meetingRoom.sealPolicyId,
        createdAt: unixToDate(meetingRoom.createdAt),
        startedAt: unixToDate(meetingRoom.startedAt),
        endedAt: unixToDate(meetingRoom.endedAt),
        transactionDigest: meetingRoom.transactionDigest,
        checkpointSequenceNumber: Number(meetingRoom.checkpointSequenceNumber),
      },
      hosts: hosts.map((h) => ({
        address: h.participantAddress,
        adminCapId: h.adminCapId,
        joinedAt: h.joinedAt,
      })),
      participants: participants.map((p) => ({
        address: p.participantAddress,
        joinedAt: p.joinedAt,
      })),
      metadata: meetingRoom.metadata
        ? {
            language: meetingRoom.metadata.language,
            timezone: meetingRoom.metadata.timezone,
            recordingBlobId: meetingRoom.metadata.recordingBlobId?.toString(),
            dynamicFieldId: meetingRoom.metadata.dynamicFieldId,
          }
        : null,
      pendingApprovals: meetingRoom.approvals.map((a) => ({
        id: a.id,
        requesterAddress: a.requesterAddress,
        createdAt: a.createdAt,
      })),
    });
  } catch (error) {
    console.error("Error fetching room:", error);
    res.status(500).json({ error: "Failed to fetch room" });
  }
});

// Other routes require authentication
router.use(authenticateToken);

/**
 * POST /api/rooms/:roomId/approval-request
 * Create an approval request for a room
 * User must be authenticated
 */
router.post(
  "/:roomId/approval-request",
  async (req: Request, res: Response) => {
    try {
      const { roomId } = req.params;
      const walletAddress = req.user!.wal; // JWT payload contains 'wal' property (wallet address)

      // Check if room exists
      const meetingRoom = await prisma.meetingRoom.findUnique({
        where: { roomId },
      });

      if (!meetingRoom) {
        return res.status(404).json({ error: "Room not found" });
      }

      // Check if room requires approval
      if (!meetingRoom.requireApproval) {
        return res
          .status(400)
          .json({ error: "Room does not require approval" });
      }

      // Check if already a participant
      const existingParticipant = await prisma.roomParticipant.findUnique({
        where: {
          roomId_participantAddress: {
            roomId,
            participantAddress: walletAddress,
          },
        },
      });

      if (existingParticipant) {
        return res.status(400).json({ error: "Already a participant" });
      }

      // Check for existing pending approval
      const existingApproval = await prisma.approvalRequest.findFirst({
        where: {
          roomId,
          requesterAddress: walletAddress,
          status: "pending",
        },
      });

      if (existingApproval) {
        return res
          .status(400)
          .json({ error: "Approval request already pending" });
      }

      // Create approval request
      const approvalRequest = await prisma.approvalRequest.create({
        data: {
          roomId,
          requesterAddress: walletAddress,
          status: "pending",
        },
      });

      res.json({
        approvalRequest: {
          id: approvalRequest.id,
          roomId: approvalRequest.roomId,
          requesterAddress: approvalRequest.requesterAddress,
          status: approvalRequest.status,
          createdAt: approvalRequest.createdAt,
        },
      });
    } catch (error) {
      console.error("Error creating approval request:", error);
      res.status(500).json({ error: "Failed to create approval request" });
    }
  }
);

/**
 * POST /api/rooms/:roomId/approve/:requestId
 * Approve a guest approval request
 * Only room hosts can approve
 */
router.post(
  "/:roomId/approve/:requestId",
  async (req: Request, res: Response) => {
    try {
      const { roomId, requestId } = req.params;
      const { txDigest } = req.body; // Transaction digest from on-chain approval
      const walletAddress = req.user!.wal;

      // Verify room exists and user is a host
      const meetingRoom = await prisma.meetingRoom.findUnique({
        where: { roomId },
        include: {
          participants: {
            where: {
              participantAddress: walletAddress,
              role: "HOST",
            },
          },
        },
      });

      if (!meetingRoom) {
        return res.status(404).json({ error: "Room not found" });
      }

      if (meetingRoom.participants.length === 0) {
        return res
          .status(403)
          .json({ error: "Only room hosts can approve guests" });
      }

      // Update approval request
      const approvalRequest = await prisma.approvalRequest.updateMany({
        where: {
          id: requestId,
          roomId,
          status: "pending",
        },
        data: {
          status: "approved",
          resolvedAt: new Date(),
          resolverAddress: walletAddress,
          resolutionTxDigest: txDigest || null,
        },
      });

      if (approvalRequest.count === 0) {
        return res
          .status(404)
          .json({ error: "Approval request not found or already processed" });
      }

      res.json({
        message: "Approval request approved",
        txDigest: txDigest || null,
      });
    } catch (error) {
      console.error("Error approving guest:", error);
      res.status(500).json({ error: "Failed to approve guest" });
    }
  }
);

/**
 * POST /api/rooms/:roomId/deny/:requestId
 * Deny a guest approval request
 * Only room hosts can deny
 */
router.post("/:roomId/deny/:requestId", async (req: Request, res: Response) => {
  try {
    const { roomId, requestId } = req.params;
    const walletAddress = req.user!.wal;

    // Verify room exists and user is a host
    const meetingRoom = await prisma.meetingRoom.findUnique({
      where: { roomId },
      include: {
        participants: {
          where: {
            participantAddress: walletAddress,
            role: "HOST",
          },
        },
      },
    });

    if (!meetingRoom) {
      return res.status(404).json({ error: "Room not found" });
    }

    if (meetingRoom.participants.length === 0) {
      return res.status(403).json({ error: "Only room hosts can deny guests" });
    }

    // Update approval request
    const approvalRequest = await prisma.approvalRequest.updateMany({
      where: {
        id: requestId,
        roomId,
        status: "pending",
      },
      data: {
        status: "denied",
        resolvedAt: new Date(),
        resolverAddress: walletAddress,
      },
    });

    if (approvalRequest.count === 0) {
      return res
        .status(404)
        .json({ error: "Approval request not found or already processed" });
    }

    res.json({
      message: "Approval request denied",
    });
  } catch (error) {
    console.error("Error denying guest:", error);
    res.status(500).json({ error: "Failed to deny guest" });
  }
});

export default router;
