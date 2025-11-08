'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCurrentAccount } from '@mysten/dapp-kit';
import {
    CopyIcon,
    ExternalLinkIcon,
    CalendarIcon,
    PersonIcon,
    CheckIcon,
    ClockIcon,
    ArrowRightIcon,
    PlusIcon,
    ExclamationTriangleIcon,
} from '@radix-ui/react-icons';
import { apiClient } from '@/lib/api';

interface RoomListItem {
    roomId: string;
    title: string;
    hosts: string[];
    status: 'scheduled' | 'active' | 'ended';
    maxParticipants: number;
    requireApproval: boolean;
    participantCount: number;
    sealPolicyId: string;
    createdAt: string | null;
    startedAt: string | null;
    endedAt: string | null;
    transactionDigest: string;
    language?: string;
    timezone?: string;
    recordingBlobId?: string;
    pendingApprovals: number;
    userRole: 'HOST' | 'PARTICIPANT' | null;
}

export default function MyRoomsPage() {
    const router = useRouter();
    const currentAccount = useCurrentAccount();
    const [rooms, setRooms] = useState<RoomListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>('');
    const [copiedId, setCopiedId] = useState<string | null>(null);

    useEffect(() => {
        if (currentAccount?.address) {
            fetchRooms();
        } else {
            setLoading(false);
            setError('Please connect your wallet to view your rooms');
        }
    }, [currentAccount]);

    const fetchRooms = async () => {
        if (!currentAccount?.address) return;

        setLoading(true);
        setError('');

        try {
            const response = await apiClient.getMyRooms(currentAccount.address);
            setRooms(response.rooms);
        } catch (err) {
            console.error('Failed to fetch rooms:', err);
            setError(err instanceof Error ? err.message : 'Failed to fetch rooms');
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = async (text: string, id: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getInviteLink = (roomId: string) => {
        return `${window.location.origin}/room/join?roomId=${roomId}`;
    };

    const viewOnExplorer = (roomId: string) => {
        window.open(`https://suiexplorer.com/object/${roomId}?network=testnet`, '_blank');
    };

    if (!currentAccount) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
                <div className="max-w-6xl mx-auto">
                    <div className="bg-white rounded-xl shadow-lg p-8">
                        <div className="flex flex-col items-center gap-4">
                            <h2 className="text-2xl font-bold text-gray-900">Connect Your Wallet</h2>
                            <p className="text-gray-600 text-center">
                                Please connect your wallet to view your rooms
                            </p>
                            <button
                                onClick={() => router.push('/room')}
                                className="px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg font-medium hover:shadow-lg transition-all"
                            >
                                Connect Wallet
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex flex-col gap-4 mb-6">
                    <div className="flex justify-between items-center">
                        <h1 className="text-4xl font-bold text-gray-900">My Meeting Rooms</h1>
                        <button
                            onClick={() => router.push('/room')}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg font-medium hover:shadow-lg transition-all cursor-pointer"
                        >
                            <PlusIcon width="16" height="16" />
                            Create Room
                        </button>
                    </div>
                    <p className="text-gray-600 text-sm">
                        View and manage all meeting rooms you've created
                    </p>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                        <ExclamationTriangleIcon width="20" height="20" className="text-red-500 mt-0.5" />
                        <div>
                            <h3 className="font-semibold text-red-900">Error</h3>
                            <p className="text-sm text-red-700">{error}</p>
                        </div>
                    </div>
                )}

                {/* Loading State */}
                {loading && (
                    <div className="bg-white rounded-xl shadow-lg p-8">
                        <div className="flex flex-col items-center gap-4">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                            <p className="text-gray-600">Loading your rooms...</p>
                        </div>
                    </div>
                )}

                {/* Empty State */}
                {!loading && !error && rooms.length === 0 && (
                    <div className="bg-white rounded-xl shadow-lg p-8">
                        <div className="flex flex-col items-center gap-4">
                            <CalendarIcon width="48" height="48" className="text-gray-400" />
                            <h2 className="text-2xl font-bold text-gray-900">No Rooms Yet</h2>
                            <p className="text-gray-600 text-center">
                                You haven't created any meeting rooms yet.
                                Create your first room to get started!
                            </p>
                            <button
                                onClick={() => router.push('/room')}
                                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg font-medium hover:shadow-lg transition-all cursor-pointer"
                            >
                                <PlusIcon width="16" height="16" />
                                Create Your First Room
                            </button>
                        </div>
                    </div>
                )}

                {/* Rooms List */}
                {!loading && rooms.length > 0 && (
                    <div className="flex flex-col gap-4">
                        {rooms.map((room) => {
                            const inviteLink = getInviteLink(room.roomId);
                            const isCopied = copiedId === room.roomId;

                            return (
                                <div key={room.roomId} className="bg-white rounded-xl shadow-lg p-6">
                                    <div className="flex flex-col gap-4">
                                        {/* Room Header */}
                                        <div className="flex justify-between items-start">
                                            <div className="flex flex-col gap-2 flex-1">
                                                <button
                                                    onClick={() => router.push(`/room/${room.roomId}`)}
                                                    className="text-left"
                                                >
                                                    <h2 className="text-2xl font-bold text-gray-900 hover:text-blue-600 transition-colors">
                                                        {room.title}
                                                    </h2>
                                                </button>
                                                <div className="flex gap-3 items-center flex-wrap">
                                                    {room.requireApproval && (
                                                        <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-medium">
                                                            Approval Required
                                                        </span>
                                                    )}
                                                    {!room.requireApproval && (
                                                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                                                            Open Access
                                                        </span>
                                                    )}
                                                    {room.pendingApprovals > 0 && (
                                                        <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">
                                                            {room.pendingApprovals} Pending
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        router.push(`/room/${room.roomId}`);
                                                    }}
                                                >
                                                    View Details
                                                </button>
                                                <button
                                                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        viewOnExplorer(room.roomId);
                                                    }}
                                                >
                                                    <ExternalLinkIcon width="14" height="14" />
                                                    Explorer
                                                </button>
                                                <button
                                                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        router.push(`/calling?roomId=${room.roomId}&role=host`);
                                                    }}
                                                >
                                                    <ArrowRightIcon width="14" height="14" />
                                                    Join as Host
                                                </button>
                                            </div>
                                        </div>

                                        <div className="border-t border-gray-200"></div>

                                        {/* Room Details */}
                                        <div className="flex gap-6 flex-wrap">
                                            <div className="flex gap-2 items-center">
                                                <PersonIcon width="16" height="16" className="text-gray-400" />
                                                <span className="text-sm text-gray-600">
                                                    {room.participantCount} {room.participantCount === 1 ? 'member' : 'members'}
                                                </span>
                                            </div>
                                            <div className="flex gap-2 items-center">
                                                <ClockIcon width="16" height="16" className="text-gray-400" />
                                                <span className="text-sm text-gray-600">
                                                    Created {room.createdAt ? formatDate(room.createdAt) : 'N/A'}
                                                </span>
                                            </div>
                                            {room.startedAt && (
                                                <div className="flex gap-2 items-center">
                                                    <CalendarIcon width="16" height="16" className="text-gray-400" />
                                                    <span className="text-sm text-gray-600">
                                                        Started: {formatDate(room.startedAt)}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="border-t border-gray-200"></div>

                                        {/* Room ID and Invite Link */}
                                        <div className="flex flex-col gap-3">
                                            <div className="flex flex-col gap-2">
                                                <span className="text-sm font-medium text-gray-600">
                                                    Room ID (On-chain)
                                                </span>
                                                <div className="flex gap-2 items-center">
                                                    <span
                                                        className="text-xs font-mono break-all flex-1 text-gray-700"
                                                    >
                                                        {room.roomId}
                                                    </span>
                                                    <button
                                                        className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            copyToClipboard(room.roomId, room.roomId);
                                                        }}
                                                    >
                                                        {isCopied ? (
                                                            <CheckIcon width="14" height="14" />
                                                        ) : (
                                                            <CopyIcon width="14" height="14" />
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <span className="text-sm font-medium text-gray-600">
                                                    Invite Link
                                                </span>
                                                <div className="flex gap-2 items-center">
                                                    <span
                                                        className="text-xs font-mono break-all flex-1 text-blue-600"
                                                    >
                                                        {inviteLink}
                                                    </span>
                                                    <button
                                                        className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            copyToClipboard(inviteLink, room.roomId);
                                                        }}
                                                    >
                                                        {isCopied ? (
                                                            <CheckIcon width="14" height="14" />
                                                        ) : (
                                                            <CopyIcon width="14" height="14" />
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
