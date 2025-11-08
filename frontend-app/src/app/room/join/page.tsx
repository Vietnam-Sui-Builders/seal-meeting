'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSuiClient, useCurrentAccount } from '@mysten/dapp-kit';
import { 
    LockClosedIcon, 
    CheckCircledIcon,
    CrossCircledIcon,
    UpdateIcon,
    ExclamationTriangleIcon,
    PersonIcon,
    ChevronRightIcon
} from '@radix-ui/react-icons';

// Package ID from environment variable
const PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID || '';

function JoinRoomPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const currentAccount = useCurrentAccount();
    const suiClient = useSuiClient();

    const roomId = searchParams.get('roomId');

    const [loading, setLoading] = useState(true);
    const [verifying, setVerifying] = useState(false);
    const [roomData, setRoomData] = useState<any>(null);
    const [accessStatus, setAccessStatus] = useState<'checking' | 'approved' | 'denied' | 'waiting'>('checking');
    const [error, setError] = useState('');

    useEffect(() => {
        if (roomId) {
            verifyAccess();
        } else {
            setError('No room ID provided');
            setLoading(false);
        }
    }, [roomId, currentAccount]);

    const verifyAccess = async () => {
        if (!roomId) return;

        setLoading(true);
        setVerifying(true);
        setError('');

        try {
            // Fetch room data
            const object = await suiClient.getObject({
                id: roomId,
                options: { showContent: true }
            });

            if (!object.data?.content || !('fields' in object.data.content)) {
                throw new Error('Room not found');
            }

            const fields = object.data.content.fields as any;
            setRoomData(fields);

            // Check if user is connected
            if (!currentAccount) {
                setAccessStatus('denied');
                setError('Please connect your wallet to verify access');
                return;
            }

            // Check whitelist
            const whitelist = fields.seal_policy?.fields?.whitelist || [];
            const isWhitelisted = whitelist.includes(currentAccount.address);

            if (isWhitelisted) {
                setAccessStatus('approved');
            } else if (fields.require_approval) {
                setAccessStatus('waiting');
            } else {
                setAccessStatus('denied');
                setError('Your address is not on the allow list');
            }
        } catch (err) {
            console.error('Failed to verify access:', err);
            setError('Failed to load room data. Please check the room ID.');
            setAccessStatus('denied');
        } finally {
            setLoading(false);
            setVerifying(false);
        }
    };

    const handleJoinMeeting = () => {
        // Navigate to calling page for video/audio meeting
        router.push(`/calling?roomId=${roomId}&role=guest`);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 flex items-center justify-center p-4">
                <div className="text-center">
                    <UpdateIcon className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">
                        Verifying Access
                    </h2>
                    <p className="text-gray-600">
                        Checking your credentials against the blockchain...
                    </p>
                </div>
            </div>
        );
    }

    const roomTitle = roomData?.title 
        ? new TextDecoder().decode(new Uint8Array(roomData.title))
        : 'Meeting Room';

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 py-8 px-4">
            <div className="max-w-2xl mx-auto">
                {/* Access Approved */}
                {accessStatus === 'approved' && (
                    <div className="bg-white rounded-2xl shadow-xl p-8">
                        <div className="text-center mb-6">
                            <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4">
                                <CheckCircledIcon className="w-12 h-12 text-green-600" />
                            </div>
                            <h1 className="text-3xl font-bold text-gray-900 mb-2">
                                Access Approved
                            </h1>
                            <p className="text-gray-600">
                                You're on the allow list for this meeting
                            </p>
                        </div>

                        {/* Meeting Details */}
                        <div className="bg-gray-50 rounded-xl p-6 mb-6">
                            <h2 className="text-xl font-semibold text-gray-900 mb-4">
                                {roomTitle}
                            </h2>
                            <div className="space-y-3 text-sm">
                                <div className="flex items-center justify-between">
                                    <span className="text-gray-600">Room ID:</span>
                                    <span className="font-mono text-xs text-gray-900 truncate ml-2 max-w-xs">
                                        {roomId}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-gray-600">Your Address:</span>
                                    <span className="font-mono text-xs text-gray-900 truncate ml-2 max-w-xs">
                                        {currentAccount?.address}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-gray-600">Host Approval:</span>
                                    <span className="font-medium text-gray-900">
                                        {roomData?.require_approval ? 'Required' : 'Not Required'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Security Info */}
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                            <div className="flex items-start gap-3">
                                <LockClosedIcon className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                                <div>
                                    <h3 className="text-sm font-semibold text-blue-900 mb-1">
                                        Sealed Meeting
                                    </h3>
                                    <p className="text-xs text-blue-700">
                                        This meeting is secured with Sui's Seal protocol. Your identity has been 
                                        verified against the on-chain whitelist policy.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Join Button */}
                        <button
                            onClick={handleJoinMeeting}
                            className="w-full px-6 py-4 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
                        >
                            Join Meeting Now
                            <ChevronRightIcon className="w-5 h-5" />
                        </button>
                    </div>
                )}

                {/* Waiting for Approval */}
                {accessStatus === 'waiting' && (
                    <div className="bg-white rounded-2xl shadow-xl p-8">
                        <div className="text-center mb-6">
                            <div className="inline-flex items-center justify-center w-20 h-20 bg-yellow-100 rounded-full mb-4">
                                <PersonIcon className="w-12 h-12 text-yellow-600" />
                            </div>
                            <h1 className="text-3xl font-bold text-gray-900 mb-2">
                                Waiting for Host Approval
                            </h1>
                            <p className="text-gray-600">
                                You're not currently on the allow list
                            </p>
                        </div>

                        {/* Meeting Details */}
                        <div className="bg-gray-50 rounded-xl p-6 mb-6">
                            <h2 className="text-xl font-semibold text-gray-900 mb-4">
                                {roomTitle}
                            </h2>
                            <div className="space-y-3 text-sm">
                                <div className="flex items-center justify-between">
                                    <span className="text-gray-600">Your Address:</span>
                                    <span className="font-mono text-xs text-gray-900 truncate ml-2 max-w-xs">
                                        {currentAccount?.address}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-gray-600">Status:</span>
                                    <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
                                        Pending Approval
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Info Box */}
                        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
                            <div className="flex items-start gap-3">
                                <UpdateIcon className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0 animate-spin" />
                                <div>
                                    <h3 className="text-sm font-semibold text-yellow-900 mb-1">
                                        Awaiting Host Action
                                    </h3>
                                    <p className="text-xs text-yellow-700">
                                        The host needs to add your address to the whitelist. Contact the meeting 
                                        organizer and share your Sui address for approval.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="space-y-3">
                            <button
                                onClick={verifyAccess}
                                disabled={verifying}
                                className="w-full px-6 py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors disabled:opacity-50"
                            >
                                {verifying ? 'Checking...' : 'Check Status Again'}
                            </button>
                            <button
                                onClick={() => router.push('/')}
                                className="w-full px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-xl font-medium hover:border-gray-400 transition-colors"
                            >
                                Back to Home
                            </button>
                        </div>
                    </div>
                )}

                {/* Access Denied */}
                {accessStatus === 'denied' && (
                    <div className="bg-white rounded-2xl shadow-xl p-8">
                        <div className="text-center mb-6">
                            <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full mb-4">
                                <CrossCircledIcon className="w-12 h-12 text-red-600" />
                            </div>
                            <h1 className="text-3xl font-bold text-gray-900 mb-2">
                                Access Denied
                            </h1>
                            <p className="text-gray-600">
                                You don't have permission to join this meeting
                            </p>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
                                <div className="flex items-start gap-3">
                                    <ExclamationTriangleIcon className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <h3 className="text-sm font-semibold text-red-900 mb-1">
                                            Verification Failed
                                        </h3>
                                        <p className="text-xs text-red-700">{error}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Details */}
                        {currentAccount && roomData && (
                            <div className="bg-gray-50 rounded-xl p-6 mb-6">
                                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                                    Your Details
                                </h2>
                                <div className="space-y-3 text-sm">
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-600">Your Address:</span>
                                        <span className="font-mono text-xs text-gray-900 truncate ml-2 max-w-xs">
                                            {currentAccount.address}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-600">Room ID:</span>
                                        <span className="font-mono text-xs text-gray-900 truncate ml-2 max-w-xs">
                                            {roomId}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Help Text */}
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                            <h3 className="text-sm font-semibold text-blue-900 mb-2">
                                What can I do?
                            </h3>
                            <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
                                <li>Contact the meeting host to add your address to the whitelist</li>
                                <li>Make sure you're connected with the correct wallet</li>
                                <li>Verify the room ID is correct</li>
                            </ul>
                        </div>

                        {/* Actions */}
                        <div className="space-y-3">
                            {!currentAccount && (
                                <button
                                    onClick={() => router.push('/login')}
                                    className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl font-medium hover:shadow-lg transition-all duration-200"
                                >
                                    Connect Wallet
                                </button>
                            )}
                            <button
                                onClick={verifyAccess}
                                disabled={verifying}
                                className="w-full px-6 py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors disabled:opacity-50"
                            >
                                {verifying ? 'Checking...' : 'Try Again'}
                            </button>
                            <button
                                onClick={() => router.push('/')}
                                className="w-full px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-xl font-medium hover:border-gray-400 transition-colors"
                            >
                                Back to Home
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// Wrap component in Suspense for Next.js 15 useSearchParams requirement
export default function JoinRoomPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 flex items-center justify-center p-4">
                <div className="text-center">
                    <UpdateIcon className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">
                        Loading
                    </h2>
                    <p className="text-gray-600">
                        Please wait...
                    </p>
                </div>
            </div>
        }>
            <JoinRoomPageContent />
        </Suspense>
    );
}
