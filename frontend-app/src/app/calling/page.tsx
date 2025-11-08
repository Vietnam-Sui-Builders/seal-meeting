"use client";
import React, { useEffect, useMemo, useRef, useState } from 'react';
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

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
];

const CallingPage = () => {
  const searchParams = useSearchParams();
  const roomId = searchParams.get('roomId') || '';
  const role = (searchParams.get('role') as 'host' | 'guest') || 'guest';

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

  const pc = useMemo(() => new RTCPeerConnection({ iceServers: ICE_SERVERS }), []);

  useEffect(() => {
    pcRef.current = pc;
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
  }, [pc, roomId, role]);

  useEffect(() => {
    const setup = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(stream);
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));
        setParticipants([
          { id: 'you', name: 'You', role: role === 'host' ? 'host' : 'guest', audioMuted: !audioEnabled, videoMuted: !videoEnabled },
        ]);

        if (role === 'host') {
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
    setup();
    return () => {
      stopPolling();
      endCall();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, role]);

  // meeting timer
  useEffect(() => {
    const intv = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(intv);
  }, []);

  const startPolling = (target: 'offer' | 'answer') => {
    stopPolling();
    pollingRef.current = setInterval(async () => {
      try {
        if (target === 'offer') {
          const off = await apiClient.getOffer(roomId).catch(() => null);
          if (off?.sdp) {
            const offerDesc = JSON.parse(off.sdp);
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
    const roleToGet = role === 'host' ? 'host' : 'guest';
    const intv = setInterval(async () => {
      try {
        const { candidates } = await apiClient.getCandidates(roomId, roleToGet);
        for (const c of candidates) {
          try {
            await pc.addIceCandidate(c);
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
      displayStream.getTracks().forEach((t) => pc.addTrack(t, displayStream));
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
            <button onClick={endCall} className="px-3 py-2 rounded bg-red-700">{role === 'host' ? 'End Meeting for All' : 'Leave'}</button>
          </div>
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

export default CallingPage;