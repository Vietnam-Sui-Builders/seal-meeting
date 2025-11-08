"use client";
import React, { useState } from "react";
import {
  PersonIcon,
  TrashIcon,
  StarIcon,
} from "@radix-ui/react-icons";

// Simple SVG icons for microphone and video
const MicrophoneIcon = ({ className }: { className?: string }) => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" className={className}>
    <path d="M6 1a2 2 0 0 0-2 2v3a2 2 0 0 0 4 0V3a2 2 0 0 0-2-2z" />
    <path d="M3 5.5a3 3 0 0 0 6 0V5h1v.5a4 4 0 0 1-3.5 3.97V10h1.5v1h-5v-1H5V9.47A4 4 0 0 1 2 5.5V5h1v.5z" />
  </svg>
);

const VideoIcon = ({ className }: { className?: string }) => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" className={className}>
    <path d="M1 2a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1H1zm8 1.5l2.5 2.5L9 8.5V3.5z" />
  </svg>
);

export type Participant = {
  id: string;
  name: string;
  role: "host" | "co-host" | "guest";
  audioMuted: boolean;
  videoMuted: boolean;
  raisedHand?: boolean;
  inLobby?: boolean;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  participants: Participant[];
  onToggleMute: (id: string) => void;
  onToggleVideo: (id: string) => void;
  onRemove: (id: string) => void;
  onMakeCoHost: (id: string) => void;
  onAdmit: (id: string) => void;
  onAdd?: (nameOrAddress: string) => void;
  canManage?: boolean;
};

export default function ParticipantsPanel({
  isOpen,
  onClose,
  participants,
  onToggleMute,
  onToggleVideo,
  onRemove,
  onMakeCoHost,
  onAdmit,
  onAdd,
  canManage = false,
}: Props) {
  if (!isOpen) return null;
  const lobby = participants.filter((p) => p.inLobby);
  const inRoom = participants.filter((p) => !p.inLobby);
  const [newMember, setNewMember] = useState("");

  return (
    <aside className="fixed right-0 top-0 bottom-0 w-80 bg-gray-900 text-white border-l border-gray-800 z-40">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <PersonIcon /> Participants ({inRoom.length})
        </div>
        <button onClick={onClose} className="text-sm px-2 py-1 bg-gray-700 rounded">Close</button>
      </div>

      {canManage && (
        <div className="px-4 py-3 border-b border-gray-800">
          <div className="text-sm text-gray-300 mb-2">Add Member</div>
          <div className="flex items-center gap-2">
            <input
              value={newMember}
              onChange={(e) => setNewMember(e.target.value)}
              placeholder="Wallet address or name"
              className="flex-1 bg-gray-800 text-white text-sm px-2 py-2 rounded"
            />
            <button
              onClick={() => {
                const v = newMember.trim();
                if (!v) return;
                onAdd?.(v);
                setNewMember("");
              }}
              className="px-3 py-2 bg-blue-700 rounded text-sm"
            >
              Add
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">Hosts can add participants during the meeting.</p>
        </div>
      )}

      {lobby.length > 0 && (
        <div className="px-4 py-3 border-b border-gray-800">
          <div className="text-sm text-gray-300 mb-2">Waiting Room</div>
          <ul className="space-y-2">
            {lobby.map((p) => (
              <li key={p.id} className="flex items-center justify-between">
                <span>{p.name}</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => onAdmit(p.id)} className="px-2 py-1 bg-blue-700 rounded text-sm">Admit</button>
                  <button onClick={() => onRemove(p.id)} className="px-2 py-1 bg-gray-700 rounded text-sm">Remove</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="px-4 py-3">
        <ul className="space-y-3">
          {inRoom.map((p) => (
            <li key={p.id} className="flex items-center justify-between">
              <div>
                <div className="font-medium">
                  {p.name} <span className="text-xs text-gray-400">({p.role})</span> {p.raisedHand && <span title="Raised hand">✋</span>}
                </div>
                <div className="text-xs text-gray-400 flex items-center gap-2">
                  {p.audioMuted ? (
                    <MicrophoneIcon className="w-3 h-3 text-red-400" />
                  ) : (
                    <MicrophoneIcon className="w-3 h-3 text-green-400" />
                  )}
                  {p.videoMuted ? (
                    <VideoIcon className="w-3 h-3 text-red-400" />
                  ) : (
                    <VideoIcon className="w-3 h-3 text-green-400" />
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => onToggleMute(p.id)} className="px-2 py-1 bg-gray-700 rounded text-sm">
                  {p.audioMuted ? "Unmute" : "Mute"}
                </button>
                <button onClick={() => onToggleVideo(p.id)} className="px-2 py-1 bg-gray-700 rounded text-sm">
                  {p.videoMuted ? "Start Video" : "Stop Video"}
                </button>
                <button onClick={() => onMakeCoHost(p.id)} className="px-2 py-1 bg-gray-700 rounded text-sm inline-flex items-center gap-1">
                  <StarIcon /> Co-host
                </button>
                <button onClick={() => onRemove(p.id)} className="px-2 py-1 bg-gray-700 rounded text-sm inline-flex items-center gap-1">
                  <TrashIcon /> Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}