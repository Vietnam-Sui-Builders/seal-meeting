"use client";
import React, { useEffect, useMemo, useRef, useState, Suspense } from 'react';
import CallControls from '@/components/calling/CallControls';
import VideoFeed from '@/components/calling/VideoFeed';
import { useSearchParams } from 'next/navigation';
import { apiClient } from '@/lib/api';
import ConferenceHeader from '@/components/calling/ConferenceHeader';
import ParticipantsPanel, { Participant } from '@/components/calling/ParticipantsPanel';
import ChatPanel, { ChatMessage } from '@/components/calling/ChatPanel';
import ReactionsBar from '@/components/calling/ReactionsBar';
import ScreenShareModal from '@/components/calling/ScreenShareModal';
import { uploadToWalrus } from '@/lib/walrus';
import { useSuiClient, useSignAndExecuteTransaction, useCurrentAccount } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
];

const CallingPage = () => {
  const searchParams = useSearchParams();
  const roomId = searchParams.get('roomId') || '';
  const role = (searchParams.get('role') as 'host' | 'guest') || 'guest';
  const client = useSuiClient();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const currentAccount = useCurrentAccount();

  const PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID || '';
  const REGISTRY_OBJECT_ID = process.env.NEXT_PUBLIC_REGISTRY_ID || '';
  const CLOCK_OBJECT_ID = '0x6';

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [speakerView, setSpeakerView] = useState(false);
  const [shareStream, setShareStream] = useState<MediaStream | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const [pcReady, setPcReady] = useState(false);
  const [hostCapId, setHostCapId] = useState<string | null>(null);
  const [chainBusy, setChainBusy] = useState(false);
  const [chainStatus, setChainStatus] = useState<string | null>(null);

  // Initialize RTCPeerConnection on client only
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;
    setPcReady(true);
    return () => {
      try { pc.close(); } catch {}
      pcRef.current = null;
      setPcReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Set up handlers when PC is ready
  useEffect(() => {
    const pc = pcRef.current;
    if (!pc || !pcReady) return;
    pc.ontrack = (event) => {
      const stream = event.streams[0];
      setRemoteStream(stream);
      setParticipants((prev) => {
        const you: Participant = {
          id: 'you', name: 'You', role: role === 'host' ? 'host' : 'guest', audioMuted: !audioEnabled, videoMuted: !videoEnabled,
        };
        const peer: Participant = {
          id: 'peer', name: 'Peer', role: role === 'host' ? 'guest' : 'host', audioMuted: false, videoMuted: false,
        };
        return [you, peer];
      });
    };
    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        try {
          await apiClient.postCandidate(roomId, event.candidate, role);
        } catch (e) {
          console.error('Failed to post candidate', e);
        }
      }
    };
    return () => {
      pc.ontrack = null;
      pc.onicecandidate = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pcReady, roomId, role, audioEnabled, videoEnabled]);

  useEffect(() => {
    const setup = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(stream);
        const pc = pcRef.current;
        if (pc) {
          stream.getTracks().forEach((t) => pc.addTrack(t, stream));
        }
        setParticipants([
          { id: 'you', name: 'You', role: role === 'host' ? 'host' : 'guest', audioMuted: !audioEnabled, videoMuted: !videoEnabled },
        ]);

        if (role === 'host') {
          const pc = pcRef.current;
          if (!pc) return;
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          await apiClient.postOffer(roomId, JSON.stringify(offer));
          // poll for answer
          startPolling('answer');
        } else {
          // guest: poll for offer, then reply with answer
          startPolling('offer');
        }
      } catch (e) {
        console.error('Media or setup error', e);
      }
    };
    if (pcReady) setup();
    return () => {
      stopPolling();
      endCall();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, role, pcReady]);

  // meeting timer
  useEffect(() => {
    const intv = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(intv);
  }, []);

  // Locate HostCap owned by current account for this room
  useEffect(() => {
    const fetchHostCap = async () => {
      try {
        setChainStatus(null);
        if (role !== 'host') return; // Only host needs HostCap
        if (!currentAccount?.address) {
          setChainStatus('Connect your wallet to manage meeting on-chain.');
          return;
        }
        if (!PACKAGE_ID || !REGISTRY_OBJECT_ID) {
          setChainStatus('Missing PACKAGE_ID or REGISTRY_OBJECT_ID. Configure env vars.');
          return;
        }
        // List HostCap objects owned by the host
        const caps = await client.getOwnedObjects({
          owner: currentAccount.address,
          filter: { StructType: `${PACKAGE_ID}::sealmeet::HostCap` },
          options: { showType: true },
        });
        if (!caps.data.length) {
          setChainStatus('No HostCap found. Create/join room as host first.');
          return;
        }
        // Find the cap linked to this room by reading its fields
        for (const o of caps.data) {
          const id = (o.data as any)?.objectId || (o as any)?.objectId;
          if (!id) continue;
          const full = await client.getObject({ id, options: { showContent: true } });
          const fields = (full.data as any)?.content?.fields;
          const capRoomId = fields?.room_id;
          if (typeof capRoomId === 'string' && capRoomId.toLowerCase() === roomId.toLowerCase()) {
            setHostCapId(id);
            setChainStatus('HostCap ready.');
            return;
          }
        }
        setChainStatus('HostCap for this room not found in your wallet.');
      } catch (err) {
        console.error('HostCap lookup failed', err);
        setChainStatus('Failed to look up HostCap. Check console.');
      }
    };
    fetchHostCap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, currentAccount?.address, PACKAGE_ID, REGISTRY_OBJECT_ID, roomId]);

  const startPolling = (target: 'offer' | 'answer') => {
    stopPolling();
    pollingRef.current = setInterval(async () => {
      try {
        if (target === 'offer') {
          const off = await apiClient.getOffer(roomId).catch(() => null);
          if (off?.sdp) {
            const offerDesc = JSON.parse(off.sdp);
            const pc = pcRef.current;
            if (!pc) return;
            await pc.setRemoteDescription(offerDesc);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await apiClient.postAnswer(roomId, JSON.stringify(answer));
            // after answering, start polling for remote candidates
            startCandidatePolling();
            stopPolling();
          }
        } else {
          const ans = await apiClient.getAnswer(roomId).catch(() => null);
          if (ans?.sdp) {
            const answerDesc = JSON.parse(ans.sdp);
            const pc = pcRef.current;
            if (!pc) return;
            await pc.setRemoteDescription(answerDesc);
            // start polling for remote candidates
            startCandidatePolling();
            stopPolling();
          }
        }
      } catch (e) {
        // ignore transient errors
      }
    }, 1500);
  };

  const startCandidatePolling = () => {
    // Poll for remote ICE candidates (role receives the other side's)
    // If you're a host, get guest candidates. If you're guest, get host candidates.
    const roleToGet = role === 'host' ? 'guest' : 'host';
    const intv = setInterval(async () => {
      try {
        const { candidates } = await apiClient.getCandidates(roomId, roleToGet);
        const pc = pcRef.current;
        for (const c of candidates) {
          try {
            if (pc) await pc.addIceCandidate(c);
          } catch (err) {
            console.warn('Failed to add ICE candidate', err);
          }
        }
      } catch (_) {
        // ignore
      }
    }, 1500);
    // Save as a second polling reference
    // We use one ref; this simple approach is fine for dev
    pollingRef.current = intv as unknown as NodeJS.Timeout;
  };

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const endCall = () => {
    try {
      localStream?.getTracks().forEach((t) => t.stop());
      shareStream?.getTracks().forEach((t) => t.stop());
      pcRef.current?.close();
      setLocalStream(null);
      setRemoteStream(null);
      setShareStream(null);
      if (isRecording) {
        stopRecording();
      }
    } catch (e) {
      console.error('End call error', e);
    }
  };

  const toggleAudio = () => {
    const enabled = !audioEnabled;
    setAudioEnabled(enabled);
    localStream?.getAudioTracks().forEach((t) => (t.enabled = enabled));
    setParticipants((prev) => prev.map((p) => (p.id === 'you' ? { ...p, audioMuted: !enabled } : p)));
  };

  const toggleVideo = () => {
    const enabled = !videoEnabled;
    setVideoEnabled(enabled);
    localStream?.getVideoTracks().forEach((t) => (t.enabled = enabled));
    setParticipants((prev) => prev.map((p) => (p.id === 'you' ? { ...p, videoMuted: !enabled } : p)));
  };

  const handleSendChat = (msg: Omit<ChatMessage, 'id' | 'time'>) => {
    const newMsg: ChatMessage = { id: Math.random().toString(36).slice(2), time: Date.now(), ...msg };
    setMessages((prev) => [...prev, newMsg]);
  };

  const startShare = async ({ audio, optimizeVideo }: { audio: boolean; optimizeVideo: boolean }) => {
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio });
      // optimize video hint
      const vTrack = displayStream.getVideoTracks()[0];
      if (vTrack && optimizeVideo) {
        try {
          // @ts-ignore
          vTrack.contentHint = 'motion';
        } catch {}
      }
      setShareStream(displayStream);
      const pc = pcRef.current;
      if (pc) displayStream.getTracks().forEach((t) => pc.addTrack(t, displayStream));
    } catch (e) {
      console.error('Screen share failed', e);
    }
  };

  const pauseShare = () => {
    shareStream?.getTracks().forEach((t) => (t.enabled = false));
  };
  const stopShare = () => {
    shareStream?.getTracks().forEach((t) => t.stop());
    setShareStream(null);
  };

  const isSharing = !!shareStream;

  const togglePin = (id: string) => setPinnedId((p) => (p === id ? null : id));

  const getRecordingTargetStream = (): MediaStream | null => {
    // Prefer share stream, then remote peer, then self.
    return shareStream || remoteStream || localStream;
  };

  const startRecording = () => {
    if (isRecording) return;
    const target = getRecordingTargetStream();
    if (!target) {
      alert('No stream available to record yet.');
      return;
    }
    try {
      recordedChunksRef.current = [];
      const mimeCandidates = [
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm',
      ];
      const mimeType = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || '';
      const rec = new MediaRecorder(target, mimeType ? { mimeType } : undefined);
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        try {
          const blob = new Blob(recordedChunksRef.current, { type: mimeType || 'video/webm' });
          const filename = `meeting-${roomId}-${Date.now()}.webm`;
          const result = await uploadToWalrus(blob, filename);
          console.log('Walrus upload result:', result);
          alert('Recording uploaded to Walrus.' + (result?.id ? ` Blob ID: ${result.id}` : ''));
        } catch (err) {
          console.error('Upload failed', err);
          alert('Upload to Walrus failed. Check console for details.');
        }
      };
      recorderRef.current = rec;
      rec.start(1000);
      setIsRecording(true);
    } catch (e) {
      console.error('Recording start failed', e);
      alert('Unable to start recording.');
    }
  };

  const stopRecording = () => {
    try {
      const rec = recorderRef.current;
      if (rec && rec.state !== 'inactive') {
        rec.stop();
      }
    } finally {
      setIsRecording(false);
    }
  };

  // On-chain: start_room
  const startRoomOnChain = async () => {
    if (chainBusy) return;
    try {
      setChainBusy(true);
      setChainStatus(null);
      if (role !== 'host') {
        alert('Only host can start the room on-chain.');
        return;
      }
      if (!currentAccount?.address) {
        alert('Connect your wallet to call start_room.');
        return;
      }
      if (!hostCapId) {
        alert('HostCap not found for this room.');
        return;
      }
      if (!PACKAGE_ID || !REGISTRY_OBJECT_ID) {
        alert('Missing PACKAGE_ID or REGISTRY_OBJECT_ID env configuration.');
        return;
      }
      const tx = new Transaction();
      tx.setGasBudget(100_000_000);
      tx.moveCall({
        target: `${PACKAGE_ID}::sealmeet::start_room`,
        arguments: [
          tx.object(hostCapId),
          tx.object(REGISTRY_OBJECT_ID),
          tx.object(roomId),
          tx.object(CLOCK_OBJECT_ID),
        ],
      });
      await new Promise<void>((resolve, reject) => {
        signAndExecuteTransaction(
          { transaction: tx },
          {
            onSuccess: (res) => {
              console.log('start_room success:', res);
              setChainStatus('Room started on-chain.');
              resolve();
            },
            onError: (err) => {
              console.error('start_room failed:', err);
              setChainStatus('start_room failed.');
              reject(err);
            },
          }
        );
      });
    } finally {
      setChainBusy(false);
    }
  };

  // On-chain: end_room
  const endRoomOnChain = async () => {
    if (chainBusy) return;
    try {
      setChainBusy(true);
      setChainStatus(null);
      if (role !== 'host') {
        alert('Only host can end the room on-chain.');
        return;
      }
      if (!currentAccount?.address) {
        alert('Connect your wallet to call end_room.');
        return;
      }
      if (!hostCapId) {
        alert('HostCap not found for this room.');
        return;
      }
      if (!PACKAGE_ID || !REGISTRY_OBJECT_ID) {
        alert('Missing PACKAGE_ID or REGISTRY_OBJECT_ID env configuration.');
        return;
      }
      const tx = new Transaction();
      tx.setGasBudget(100_000_000);
      tx.moveCall({
        target: `${PACKAGE_ID}::sealmeet::end_room`,
        arguments: [
          tx.object(hostCapId),
          tx.object(REGISTRY_OBJECT_ID),
          tx.object(roomId),
          tx.object(CLOCK_OBJECT_ID),
        ],
      });
      await new Promise<void>((resolve, reject) => {
        signAndExecuteTransaction(
          { transaction: tx },
          {
            onSuccess: (res) => {
              console.log('end_room success:', res);
              setChainStatus('Room ended on-chain.');
              resolve();
            },
            onError: (err) => {
              console.error('end_room failed:', err);
              setChainStatus('end_room failed.');
              reject(err);
            },
          }
        );
      });
    } finally {
      setChainBusy(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-950">
      <ConferenceHeader
        meetingTitle={`Room ${roomId || 'unknown'}`}
        elapsedSeconds={elapsedSeconds}
        isSecure
        isRecording={isRecording}
        onToggleRecording={() => {
          if (!isRecording) {
            const ok = window.confirm('Allow recording this meeting?');
            if (ok) startRecording();
          } else {
            stopRecording();
          }
        }}
        captionsEnabled={captionsEnabled}
        onToggleCaptions={() => setCaptionsEnabled((v) => !v)}
      />

      <div className="flex-1 relative">
        {/* Side panels */}
        <ParticipantsPanel
          isOpen={showParticipants}
          onClose={() => setShowParticipants(false)}
          participants={participants}
          onToggleMute={(id) =>
            setParticipants((prev) => prev.map((p) => (p.id === id ? { ...p, audioMuted: !p.audioMuted } : p)))
          }
          onToggleVideo={(id) =>
            setParticipants((prev) => prev.map((p) => (p.id === id ? { ...p, videoMuted: !p.videoMuted } : p)))
          }
          onRemove={(id) => setParticipants((prev) => prev.filter((p) => p.id !== id))}
          onMakeCoHost={(id) =>
            setParticipants((prev) => prev.map((p) => (p.id === id ? { ...p, role: 'co-host' } : p)))
          }
          onAdmit={(id) => setParticipants((prev) => prev.map((p) => (p.id === id ? { ...p, inLobby: false } : p)))}
          canManage={role === 'host'}
          onAdd={(nameOrAddress) =>
            setParticipants((prev) => [
              ...prev,
              {
                id: `member-${Math.random().toString(36).slice(2)}`,
                name: nameOrAddress,
                role: 'guest',
                audioMuted: false,
                videoMuted: false,
              },
            ])
          }
        />
        <ChatPanel
          isOpen={showChat}
          onClose={() => setShowChat(false)}
          messages={messages}
          onSend={handleSendChat}
          participants={participants.map((p) => ({ id: p.id, name: p.name, role: p.role }))}
        />

        {/* Main stage */}
        <div className="max-w-7xl mx-auto px-4 py-4">
          {isSharing ? (
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-9">
                <div className="border border-gray-800 rounded-lg p-1 bg-black">
                  <VideoFeed stream={shareStream} label="Your Screen" heightClass="h-[460px]" />
                </div>
              </div>
              <div className="col-span-3 flex flex-col gap-3">
                <div onDoubleClick={() => togglePin('you')} className="cursor-pointer">
                  <div className="border border-gray-800 rounded-lg p-1 bg-black">
                    <VideoFeed
                      stream={localStream}
                      label="You"
                      audioMuted={!audioEnabled}
                      videoMuted={!videoEnabled}
                      pinned={pinnedId === 'you'}
                      heightClass="h-40"
                    />
                  </div>
                </div>
                <div onDoubleClick={() => togglePin('peer')} className="cursor-pointer">
                  <div className="border border-gray-800 rounded-lg p-1 bg-black">
                    <VideoFeed
                      stream={remoteStream}
                      label="Peer"
                      audioMuted={false}
                      videoMuted={false}
                      pinned={pinnedId === 'peer'}
                      heightClass="h-40"
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              <div onDoubleClick={() => togglePin('you')} className="cursor-pointer">
                <div className="border border-gray-800 rounded-lg p-1 bg-black">
                  <VideoFeed
                    stream={localStream}
                    label="You"
                    audioMuted={!audioEnabled}
                    videoMuted={!videoEnabled}
                    pinned={pinnedId === 'you'}
                    heightClass="h-64"
                  />
                </div>
              </div>
              <div onDoubleClick={() => togglePin('peer')} className="cursor-pointer">
                <div className="border border-gray-800 rounded-lg p-1 bg-black">
                  <VideoFeed
                    stream={remoteStream}
                    label="Peer"
                    audioMuted={false}
                    videoMuted={false}
                    pinned={pinnedId === 'peer'}
                    heightClass="h-64"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Dock controls */}
        <div className="fixed bottom-4 left-0 right-0 flex flex-col items-center gap-3">
          <ReactionsBar
            onReact={(emoji) =>
              setParticipants((prev) => prev.map((p) => (p.id === 'you' ? { ...p, raisedHand: false } : p)))
            }
            onRaiseHand={() => setParticipants((prev) => prev.map((p) => (p.id === 'you' ? { ...p, raisedHand: true } : p)))}
          />
          <div className="flex items-center gap-3 bg-gray-900/90 text-white px-4 py-3 rounded-full border border-gray-800">
            <button onClick={toggleAudio} className={`px-3 py-2 rounded ${audioEnabled ? 'bg-gray-700' : 'bg-red-700'}`}>
              {audioEnabled ? 'Mute' : 'Unmute'}
            </button>
            <button onClick={toggleVideo} className={`px-3 py-2 rounded ${videoEnabled ? 'bg-gray-700' : 'bg-red-700'}`}>
              {videoEnabled ? 'Stop Video' : 'Start Video'}
            </button>
            <button onClick={() => setShowShareModal(true)} className="px-3 py-2 rounded bg-gray-700">
              Share Screen
            </button>
            <button onClick={() => setShowParticipants(true)} className="px-3 py-2 rounded bg-gray-700">Participants</button>
            <button onClick={() => setShowChat(true)} className="px-3 py-2 rounded bg-gray-700">Chat</button>
            <button onClick={() => setSpeakerView((v) => !v)} className="px-3 py-2 rounded bg-gray-700">
              {speakerView ? 'Speaker View' : 'Gallery View'}
            </button>
            {role === 'host' && (
              <>
                <button onClick={startRoomOnChain} disabled={chainBusy || !hostCapId} className="px-3 py-2 rounded bg-green-700 disabled:opacity-50">
                  Start On-Chain
                </button>
                <button onClick={endRoomOnChain} disabled={chainBusy || !hostCapId} className="px-3 py-2 rounded bg-yellow-700 disabled:opacity-50">
                  End On-Chain
                </button>
              </>
            )}
            <button onClick={endCall} className="px-3 py-2 rounded bg-red-700">{role === 'host' ? 'End Meeting for All' : 'Leave'}</button>
          </div>
          {role === 'host' && chainStatus && (
            <div className="text-xs text-gray-300 bg-gray-800/70 px-3 py-1 rounded">
              {chainStatus}
            </div>
          )}
        </div>

        {/* Screen share modal */}
        <ScreenShareModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          onStartShare={(opts) => { setShowShareModal(false); startShare(opts); }}
          isSharing={isSharing}
          onPause={pauseShare}
          onStop={stopShare}
        />
      </div>
    </div>
  );
};

// Wrap component in Suspense for Next.js 15 useSearchParams requirement
export default function CallingPageWrapper() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white">Loading meeting...</p>
        </div>
      </div>
    }>
      <CallingPage />
    </Suspense>
  );
}