'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSuiClient, useCurrentAccount } from '@mysten/dapp-kit';
import {
    ArrowLeftIcon,
    CopyIcon,
    CheckIcon,
    ExternalLinkIcon,
    PersonIcon,
    CalendarIcon,
    ClockIcon,
    LockClosedIcon,
    ExclamationTriangleIcon,
} from '@radix-ui/react-icons';
import { apiClient } from '@/lib/api';

// Package ID from environment variable
const PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID || '';

function RoomDetailPageContent() {
    const router = useRouter();
    const params = useParams();
    const currentAccount = useCurrentAccount();
    const suiClient = useSuiClient();

    const roomId = params.roomId as string;

    const [loading, setLoading] = useState(true);
    const [roomData, setRoomData] = useState<any>(null);
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (roomId) {
            loadRoomData();
        }
    }, [roomId]);

    const loadRoomData = async () => {
        if (!roomId) return;

        setLoading(true);
        setError('');

        try {
            // Fetch room data from blockchain
            const object = await suiClient.getObject({
                id: roomId,
                options: { showContent: true }
            });

            if (!object.data?.content || !('fields' in object.data.content)) {
                throw new Error('Room not found');
            }

            const fields = object.data.content.fields as any;
            setRoomData(fields);
        } catch (err) {
            console.error('Failed to load room:', err);
            setError(err instanceof Error ? err.message : 'Failed to load room data');
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const formatDate = (timestamp: number) => {
        if (!timestamp || timestamp === 0) return 'Not started';
        const date = new Date(timestamp);
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getInviteLink = () => {
        return `${window.location.origin}/room/join?roomId=${roomId}`;
    };

    const viewOnExplorer = () => {
        window.open(`https://suiexplorer.com/object/${roomId}?network=testnet`, '_blank');
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
                <div className="max-w-4xl mx-auto">
                    <div className="bg-white rounded-xl shadow-lg p-8">
                        <div className="flex flex-col items-center gap-4">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                            <p className="text-gray-600">Loading room details...</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (error || !roomData) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
                <div className="max-w-4xl mx-auto">
                    <div className="bg-white rounded-xl shadow-lg p-8">
                        <div className="flex flex-col items-center gap-4">
                            <ExclamationTriangleIcon width="48" height="48" className="text-red-500" />
                            <h2 className="text-2xl font-bold text-gray-900">Room Not Found</h2>
                            <p className="text-gray-600 text-center">{error || 'The room you are looking for does not exist.'}</p>
                            <button
                                onClick={() => router.push('/my-rooms')}
                                className="px-6 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors"
                            >
                                Back to My Rooms
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const roomTitle = roomData.title 
        ? (typeof roomData.title === 'string' ? roomData.title : new TextDecoder().decode(new Uint8Array(roomData.title)))
        : 'Untitled Room';

    const description = roomData.description 
        ? (typeof roomData.description === 'string' ? roomData.description : new TextDecoder().decode(new Uint8Array(roomData.description)))
        : null;

    const whitelist = roomData.seal_policy?.fields?.whitelist || [];
    const hosts = roomData.hosts || [];
    const participants = roomData.participants || [];
    const statusMap: Record<number, string> = {
        1: 'Scheduled',
        2: 'Active',
        3: 'Ended',
    };
    const status = statusMap[roomData.status] || 'Unknown';
    
    const getStatusColorClasses = () => {
        if (roomData.status === 2) return 'bg-green-100 text-green-700';
        if (roomData.status === 3) return 'bg-gray-100 text-gray-700';
        return 'bg-blue-100 text-blue-700';
    };
    const statusColorClasses = getStatusColorClasses();

    const inviteLink = getInviteLink();
    const isHost = currentAccount && hosts.includes(currentAccount.address);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <button
                        onClick={() => router.back()}
                        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
                    >
                        <ArrowLeftIcon width="16" height="16" />
                        Back
                    </button>
                    <h1 className="text-4xl font-bold text-gray-900">Room Details</h1>
                </div>

                {/* Room Info Card */}
                <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                            <h2 className="text-3xl font-bold text-gray-900 mb-2">{roomTitle}</h2>
                            {description && (
                                <p className="text-gray-600 mb-4">{description}</p>
                            )}
                            <div className="flex gap-3 items-center flex-wrap">
                                <span className={`px-3 py-1 ${statusColorClasses} rounded-full text-sm font-medium`}>
                                    {status}
                                </span>
                                {roomData.require_approval ? (
                                    <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-medium">
                                        Approval Required
                                    </span>
                                ) : (
                                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                                        Open Access
                                    </span>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={viewOnExplorer}
                            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                        >
                            <ExternalLinkIcon width="16" height="16" />
                            View on Explorer
                        </button>
                    </div>

                    <div className="border-t border-gray-200 pt-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                                <p className="text-sm text-gray-500 mb-1">Max Participants</p>
                                <p className="text-lg font-semibold text-gray-900">{roomData.max_participants || 'N/A'}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500 mb-1">Current Participants</p>
                                <p className="text-lg font-semibold text-gray-900">{participants.length}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500 mb-1">Hosts</p>
                                <p className="text-lg font-semibold text-gray-900">{hosts.length}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500 mb-1">Whitelist Size</p>
                                <p className="text-lg font-semibold text-gray-900">{whitelist.length}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Room ID and Invite Link */}
                <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
                    <h3 className="text-xl font-semibold text-gray-900 mb-4">Room Information</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Room ID (On-chain)
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={roomId}
                                    readOnly
                                    className="flex-1 px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg font-mono text-sm text-gray-900"
                                />
                                <button
                                    onClick={() => copyToClipboard(roomId)}
                                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                                >
                                    {copied ? <CheckIcon width="16" height="16" /> : <CopyIcon width="16" height="16" />}
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Invite Link
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={inviteLink}
                                    readOnly
                                    className="flex-1 px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-900"
                                />
                                <button
                                    onClick={() => copyToClipboard(inviteLink)}
                                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                                >
                                    {copied ? <CheckIcon width="16" height="16" /> : <CopyIcon width="16" height="16" />}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Timestamps */}
                <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
                    <h3 className="text-xl font-semibold text-gray-900 mb-4">Timeline</h3>
                    <div className="space-y-3">
                        <div className="flex items-center gap-3">
                            <CalendarIcon width="20" height="20" className="text-gray-400" />
                            <div>
                                <p className="text-sm text-gray-500">Created</p>
                                <p className="text-gray-900">{formatDate(roomData.created_at)}</p>
                            </div>
                        </div>
                        {roomData.started_at && roomData.started_at > 0 && (
                            <div className="flex items-center gap-3">
                                <ClockIcon width="20" height="20" className="text-green-500" />
                                <div>
                                    <p className="text-sm text-gray-500">Started</p>
                                    <p className="text-gray-900">{formatDate(roomData.started_at)}</p>
                                </div>
                            </div>
                        )}
                        {roomData.ended_at && roomData.ended_at > 0 && (
                            <div className="flex items-center gap-3">
                                <ClockIcon width="20" height="20" className="text-red-500" />
                                <div>
                                    <p className="text-sm text-gray-500">Ended</p>
                                    <p className="text-gray-900">{formatDate(roomData.ended_at)}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Participants List */}
                <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
                    <h3 className="text-xl font-semibold text-gray-900 mb-4">
                        Participants ({participants.length})
                    </h3>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                        {participants.map((address: string, index: number) => {
                            const isHost = hosts.includes(address);
                            const isCurrentUser = currentAccount?.address === address;
                            return (
                                <div
                                    key={index}
                                    className={`flex items-center justify-between p-3 rounded-lg ${
                                        isCurrentUser ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <PersonIcon width="16" height="16" className="text-gray-400" />
                                        <span className="font-mono text-sm text-gray-900">
                                            {address.slice(0, 8)}...{address.slice(-6)}
                                        </span>
                                        {isHost && (
                                            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                                                Host
                                            </span>
                                        )}
                                        {isCurrentUser && (
                                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                                                You
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        {participants.length === 0 && (
                            <p className="text-gray-500 text-center py-4">No participants yet</p>
                        )}
                    </div>
                </div>

                {/* Actions */}
                {isHost && (
                    <div className="bg-white rounded-xl shadow-lg p-6">
                        <h3 className="text-xl font-semibold text-gray-900 mb-4">Host Actions</h3>
                        <div className="flex gap-3">
                            <button
                                onClick={() => router.push(`/room?roomId=${roomId}`)}
                                className="flex-1 px-6 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors"
                            >
                                Manage Room
                            </button>
                            <button
                                onClick={() => router.push(`/calling?roomId=${roomId}&role=host`)}
                                className="flex-1 px-6 py-3 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors"
                            >
                                Start Meeting
                            </button>
                        </div>
                    </div>
                )}

                {!isHost && currentAccount && whitelist.includes(currentAccount.address) && (
                    <div className="bg-white rounded-xl shadow-lg p-6">
                        <button
                            onClick={() => router.push(`/calling?roomId=${roomId}&role=guest`)}
                            className="w-full px-6 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors"
                        >
                            Join Meeting
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

// Wrap component in Suspense for Next.js 15 useParams requirement
export default function RoomDetailPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
                <div className="max-w-4xl mx-auto">
                    <div className="bg-white rounded-xl shadow-lg p-8">
                        <div className="flex flex-col items-center gap-4">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                            <p className="text-gray-600">Loading...</p>
                        </div>
                    </div>
                </div>
            </div>
        }>
            <RoomDetailPageContent />
        </Suspense>
    );
}

