import { Router, Request, Response } from 'express';

// In-memory signaling store (development only)
type Candidate = any;
interface RoomSignals {
  offer?: { sdp: string; timestamp: number };
  answer?: { sdp: string; timestamp: number };
  hostCandidates: Candidate[];
  guestCandidates: Candidate[];
}

const rooms: Record<string, RoomSignals> = {};

const router = Router();

function ensureRoom(roomId: string): RoomSignals {
  if (!rooms[roomId]) {
    rooms[roomId] = { hostCandidates: [], guestCandidates: [] };
  }
  return rooms[roomId];
}

// Offer
router.post('/:roomId/offer', (req: Request, res: Response) => {
  const { roomId } = req.params;
  const { sdp } = req.body;
  if (!sdp) return res.status(400).json({ error: 'Missing sdp' });
  const r = ensureRoom(roomId);
  r.offer = { sdp, timestamp: Date.now() };
  res.json({ ok: true });
});

router.get('/:roomId/offer', (req: Request, res: Response) => {
  const { roomId } = req.params;
  const r = rooms[roomId];
  if (!r?.offer) return res.status(404).json({ error: 'No offer' });
  res.json(r.offer);
});

// Answer
router.post('/:roomId/answer', (req: Request, res: Response) => {
  const { roomId } = req.params;
  const { sdp } = req.body;
  if (!sdp) return res.status(400).json({ error: 'Missing sdp' });
  const r = ensureRoom(roomId);
  r.answer = { sdp, timestamp: Date.now() };
  res.json({ ok: true });
});

router.get('/:roomId/answer', (req: Request, res: Response) => {
  const { roomId } = req.params;
  const r = rooms[roomId];
  if (!r?.answer) return res.status(404).json({ error: 'No answer' });
  res.json(r.answer);
});

// ICE candidates
router.post('/:roomId/candidates', (req: Request, res: Response) => {
  const { roomId } = req.params;
  const { candidate, from } = req.body as { candidate: Candidate; from: 'host' | 'guest' };
  if (!candidate || !from) return res.status(400).json({ error: 'Missing candidate or from' });
  const r = ensureRoom(roomId);
  if (from === 'host') r.hostCandidates.push(candidate);
  else r.guestCandidates.push(candidate);
  res.json({ ok: true });
});

router.get('/:roomId/candidates', (req: Request, res: Response) => {
  const { roomId } = req.params;
  const { role } = req.query as { role?: 'host' | 'guest' };
  const r = rooms[roomId];
  if (!r || !role) return res.status(404).json({ error: 'No candidates or role not provided' });
  const list = role === 'host' ? r.guestCandidates : r.hostCandidates;
  // return and clear to avoid duplicates
  const out = [...list];
  if (role === 'host') r.guestCandidates = [];
  else r.hostCandidates = [];
  res.json({ candidates: out });
});

// End call / cleanup room signaling data
router.post('/:roomId/end', (req: Request, res: Response) => {
  const { roomId } = req.params;
  const { role } = req.body as { role?: 'host' | 'guest' };
  
  if (!rooms[roomId]) {
    // Room doesn't exist, but that's okay - already cleaned up
    return res.json({ ok: true, message: 'Room already cleaned up' });
  }

  // If host ends the call, clean up the entire room
  // If guest leaves, just acknowledge (room data remains for other participants)
  if (role === 'host') {
    delete rooms[roomId];
    console.log(`[Signaling] Room ${roomId} cleaned up by host`);
    res.json({ ok: true, message: 'Room cleaned up' });
  } else {
    // Guest leaving - just acknowledge (host might still be there)
    console.log(`[Signaling] Guest left room ${roomId}`);
    res.json({ ok: true, message: 'Guest left' });
  }
});

export default router;