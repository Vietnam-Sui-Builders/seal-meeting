'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSuiClient, useSignAndExecuteTransaction, useCurrentAccount } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { 
    PlusIcon, 
    Cross2Icon, 
    CheckIcon, 
    CopyIcon, 
    Share1Icon,
    PersonIcon,
    LockClosedIcon,
    UpdateIcon,
    ExclamationTriangleIcon,
    ChevronRightIcon
} from '@radix-ui/react-icons';

// TODO: Replace with deployed package ID
const PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID || 'YOUR_PACKAGE_ID';
const CLOCK_OBJECT_ID = '0x6'; // Sui Clock object (shared)

interface WhitelistAddress {
    address: string;
    addedAt?: number;
}

type ViewMode = 'create' | 'manage' | 'verify';

function RoomPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();
    const currentAccount = useCurrentAccount();
    const suiClient = useSuiClient();

    // View mode state
    const [viewMode, setViewMode] = useState<ViewMode>('create');
    const roomIdParam = searchParams.get('roomId');

    // Redirect to home if user disconnects from manage view
    useEffect(() => {
        if (viewMode === 'manage' && !currentAccount) {
            router.push('/');
        }
    }, [currentAccount, viewMode, router]);

    // Form state for creating meeting
    const [formData, setFormData] = useState({
        title: '',
        date: '',
        time: '',
        duration: '60',
        requireApproval: true,
    });

    // Whitelist management
    const [whitelist, setWhitelist] = useState<WhitelistAddress[]>([]);
    const [newAddress, setNewAddress] = useState('');
    const [addressError, setAddressError] = useState('');

    // Room state (after creation or when managing)
    const [roomId, setRoomId] = useState<string>(roomIdParam || '');
    const [inviteLink, setInviteLink] = useState('');
    const [roomData, setRoomData] = useState<any>(null);

    // UI state
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [copied, setCopied] = useState(false);

    // Load room data if roomId is present
    useEffect(() => {
        if (roomId) {
            setViewMode('manage');
            loadRoomData(roomId);
        }
    }, [roomId]);

    const loadRoomData = async (id: string) => {
        try {
            setLoading(true);
            const object = await suiClient.getObject({
                id,
                options: { showContent: true }
            });
            
            if (object.data?.content && 'fields' in object.data.content) {
                const fields = object.data.content.fields as any;
                setRoomData(fields);
                
                // Load whitelist from seal_policy
                if (fields.seal_policy?.fields?.whitelist) {
                    const addresses = fields.seal_policy.fields.whitelist.map((addr: string) => ({
                        address: addr,
                        addedAt: Date.now()
                    }));
                    setWhitelist(addresses);
                }
                
                // Generate invite link
                const link = `${window.location.origin}/room/join?roomId=${id}`;
                setInviteLink(link);
            }
        } catch (err) {
            console.error('Failed to load room:', err);
            setError('Failed to load room data');
        } finally {
            setLoading(false);
        }
    };

    const validateSuiAddress = (address: string): boolean => {
        const cleanAddr = address.trim();
        if (!cleanAddr.startsWith('0x')) {
            setAddressError('Address must start with 0x');
            return false;
        }
        if (cleanAddr.length < 3 || cleanAddr.length > 66) {
            setAddressError('Invalid address length');
            return false;
        }
        if (!/^0x[a-fA-F0-9]+$/.test(cleanAddr)) {
            setAddressError('Address must be hexadecimal');
            return false;
        }
        setAddressError('');
        return true;
    };

    const addToWhitelist = () => {
        const cleanAddr = newAddress.trim();
        if (!validateSuiAddress(cleanAddr)) return;

        if (whitelist.some(item => item.address === cleanAddr)) {
            setAddressError('Address already in whitelist');
            return;
        }

        setWhitelist([...whitelist, { address: cleanAddr, addedAt: Date.now() }]);
        setNewAddress('');
        setAddressError('');
    };

    const removeFromWhitelist = (address: string) => {
        setWhitelist(whitelist.filter(item => item.address !== address));
    };

    const handleCreateRoom = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!currentAccount) {
            setError('Please connect your wallet first');
            return;
        }

        if (whitelist.length === 0) {
            setError('Add at least one participant to the whitelist');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const txb = new Transaction();
            
            // Encode title as bytes
            const titleBytes = Array.from(new TextEncoder().encode(formData.title));
            
            // Get addresses from whitelist
            const addresses = whitelist.map(item => item.address);

            txb.moveCall({
                target: `${PACKAGE_ID}::meeting_room::create_room`,
                arguments: [
                    txb.pure.vector('u8', titleBytes),
                    txb.pure.vector('address', addresses),
                    txb.pure.bool(formData.requireApproval),
                ],
            });

            signAndExecuteTransaction(
                { transaction: txb },
                {
                    onSuccess: (result) => {
                        console.log('Room created:', result);
                        
                        // Extract created room ID from transaction effects
                        try {
                            const effects = result.effects as any;
                            if (effects?.created && Array.isArray(effects.created) && effects.created.length > 0) {
                                const newRoomId = effects.created[0]?.reference?.objectId;
                                if (newRoomId) {
                                    setRoomId(newRoomId);
                                    setSuccessMessage('Meeting room created successfully!');
                                    setViewMode('manage');
                                    
                                    // Generate invite link
                                    const link = `${window.location.origin}/room/join?roomId=${newRoomId}`;
                                    setInviteLink(link);
                                    return;
                                }
                            }
                        } catch (e) {
                            console.error('Error extracting room ID:', e);
                        }
                        // Fallback if we can't extract room ID
                        setSuccessMessage('Room created! Check transaction on explorer.');
                    },
                    onError: (err) => {
                        console.error('Failed to create room:', err);
                        setError('Failed to create room. Please try again.');
                    }
                }
            );
        } catch (err) {
            console.error('Transaction error:', err);
            setError('Failed to create room. Please check your inputs.');
        } finally {
            setLoading(false);
        }
    };

    const handleApproveGuest = async (guestAddress: string) => {
        if (!currentAccount || !roomId) return;

        setLoading(true);
        try {
            const txb = new Transaction();
            txb.moveCall({
                target: `${PACKAGE_ID}::meeting_room::approve_guest`,
                arguments: [
                    txb.object(roomId),
                    txb.pure.address(guestAddress),
                    txb.object(CLOCK_OBJECT_ID),
                ],
            });

            signAndExecuteTransaction(
                { transaction: txb },
                {
                    onSuccess: () => {
                        setSuccessMessage(`Guest ${guestAddress.slice(0, 8)}... approved`);
                        loadRoomData(roomId);
                    },
                    onError: (err) => {
                        console.error('Failed to approve guest:', err);
                        setError('Failed to approve guest');
                    }
                }
            );
        } catch (err) {
            console.error('Transaction error:', err);
            setError('Failed to approve guest');
        } finally {
            setLoading(false);
        }
    };

    const handleRevokeGuest = async (guestAddress: string) => {
        if (!currentAccount || !roomId) return;

        setLoading(true);
        try {
            const txb = new Transaction();
            txb.moveCall({
                target: `${PACKAGE_ID}::meeting_room::revoke_guest`,
                arguments: [
                    txb.object(roomId),
                    txb.pure.address(guestAddress),
                    txb.object(CLOCK_OBJECT_ID),
                ],
            });

            signAndExecuteTransaction(
                { transaction: txb },
                {
                    onSuccess: () => {
                        setSuccessMessage(`Guest ${guestAddress.slice(0, 8)}... revoked`);
                        removeFromWhitelist(guestAddress);
                        loadRoomData(roomId);
                    },
                    onError: (err) => {
                        console.error('Failed to revoke guest:', err);
                        setError('Failed to revoke guest');
                    }
                }
            );
        } catch (err) {
            console.error('Transaction error:', err);
            setError('Failed to revoke guest');
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Create Meeting View
    if (viewMode === 'create') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 py-8 px-4">
                <div className="max-w-4xl mx-auto">
                    {/* Header */}
                    <div className="mb-8">
                        <h1 className="text-4xl font-bold text-gray-900 mb-2">
                            Create Secure Meeting
                        </h1>
                        <p className="text-gray-600">
                            Set up your meeting with blockchain-secured access control
                        </p>
                    </div>

                    {/* Error/Success Messages */}
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                            <ExclamationTriangleIcon className="w-5 h-5 text-red-500 mt-0.5" />
                            <p className="text-sm text-red-600">{error}</p>
                        </div>
                    )}

                    {successMessage && (
                        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-start gap-3">
                            <CheckIcon className="w-5 h-5 text-green-500 mt-0.5" />
                            <p className="text-sm text-green-600">{successMessage}</p>
                        </div>
                    )}

                    <div className="grid md:grid-cols-2 gap-6">
                        {/* Meeting Details Form */}
                        <div className="bg-white rounded-2xl shadow-lg p-6">
                            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <LockClosedIcon className="w-5 h-5 text-blue-500" />
                                Meeting Details
                            </h2>
                            <form onSubmit={handleCreateRoom} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Meeting Title *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                                        placeholder="Team Sync - Q1 Planning"
                                        required
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Date *
                                        </label>
                                        <input
                                            type="date"
                                            value={formData.date}
                                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Time *
                                        </label>
                                        <input
                                            type="time"
                                            value={formData.time}
                                            onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Duration (minutes)
                                    </label>
                                    <select
                                        value={formData.duration}
                                        onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                                    >
                                        <option value="30">30 minutes</option>
                                        <option value="60">1 hour</option>
                                        <option value="90">1.5 hours</option>
                                        <option value="120">2 hours</option>
                                    </select>
                                </div>

                                <div className="pt-4 border-t border-gray-200">
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.requireApproval}
                                            onChange={(e) => setFormData({ ...formData, requireApproval: e.target.checked })}
                                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                        />
                                        <span className="text-sm text-gray-700">
                                            Require host approval for new guests
                                        </span>
                                    </label>
                                    <p className="text-xs text-gray-500 mt-2 ml-7">
                                        Guests not on whitelist will wait for your approval
                                    </p>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading || whitelist.length === 0}
                                    className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg font-medium hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {loading ? (
                                        <>
                                            <UpdateIcon className="w-4 h-4 animate-spin" />
                                            Creating & Sealing...
                                        </>
                                    ) : (
                                        <>
                                            <LockClosedIcon className="w-4 h-4" />
                                            Create & Seal Invite
                                        </>
                                    )}
                                </button>
                            </form>
                        </div>

                        {/* Whitelist Management */}
                        <div className="bg-white rounded-2xl shadow-lg p-6">
                            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <PersonIcon className="w-5 h-5 text-cyan-500" />
                                Allow List ({whitelist.length})
                            </h2>

                            {/* Add Address Input */}
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Add Participant Address
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newAddress}
                                        onChange={(e) => setNewAddress(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addToWhitelist())}
                                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-gray-900"
                                        placeholder="0x123abc..."
                                    />
                                    <button
                                        type="button"
                                        onClick={addToWhitelist}
                                        className="px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
                                    >
                                        <PlusIcon className="w-5 h-5" />
                                    </button>
                                </div>
                                {addressError && (
                                    <p className="text-xs text-red-500 mt-1">{addressError}</p>
                                )}
                            </div>

                            {/* Whitelist Display */}
                            <div className="space-y-2 max-h-96 overflow-y-auto">
                                {whitelist.length === 0 ? (
                                    <div className="text-center py-8 text-gray-400">
                                        <PersonIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                        <p className="text-sm">No participants yet</p>
                                        <p className="text-xs">Add Sui addresses to whitelist</p>
                                    </div>
                                ) : (
                                    whitelist.map((item, index) => (
                                        <div
                                            key={index}
                                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-cyan-300 transition-colors"
                                        >
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                                                    <PersonIcon className="w-4 h-4 text-white" />
                                                </div>
                                                <span className="text-sm font-mono text-gray-700 truncate">
                                                    {item.address}
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => removeFromWhitelist(item.address)}
                                                className="p-1 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                                            >
                                                <Cross2Icon className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>

                            {whitelist.length > 0 && (
                                <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                    <p className="text-xs text-blue-700">
                                        <strong>Seal Policy:</strong> Only these addresses can decrypt the invite and join the meeting.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Manage Room View (after creation)
    if (viewMode === 'manage') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 py-8 px-4">
                <div className="max-w-4xl mx-auto">
                    {/* Header */}
                    <div className="mb-8">
                        <h1 className="text-4xl font-bold text-gray-900 mb-2">
                            {roomData?.title ? new TextDecoder().decode(new Uint8Array(roomData.title)) : 'Meeting Room'}
                        </h1>
                        <p className="text-gray-600 flex items-center gap-2">
                            <CheckIcon className="w-4 h-4 text-green-500" />
                            Sealed and secured on Sui blockchain
                        </p>
                    </div>

                    {/* Success/Error Messages */}
                    {successMessage && (
                        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-start gap-3">
                            <CheckIcon className="w-5 h-5 text-green-500 mt-0.5" />
                            <p className="text-sm text-green-600">{successMessage}</p>
                        </div>
                    )}

                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                            <ExclamationTriangleIcon className="w-5 h-5 text-red-500 mt-0.5" />
                            <p className="text-sm text-red-600">{error}</p>
                        </div>
                    )}

                    <div className="grid md:grid-cols-2 gap-6">
                        {/* Invite Sharing */}
                        <div className="bg-white rounded-2xl shadow-lg p-6">
                            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <Share1Icon className="w-5 h-5 text-blue-500" />
                                Share Invite
                            </h2>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Room ID
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
                                            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                                        >
                                            {copied ? <CheckIcon className="w-4 h-4" /> : <CopyIcon className="w-4 h-4" />}
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
                                            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                                        >
                                            {copied ? <CheckIcon className="w-4 h-4" /> : <CopyIcon className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-gray-200">
                                    <p className="text-xs text-gray-500 mb-3">
                                        Only whitelisted addresses can access this meeting
                                    </p>
                                    <button
                                        onClick={() => router.push(`/room/join?roomId=${roomId}`)}
                                        className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg font-medium hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
                                    >
                                        Join Meeting
                                        <ChevronRightIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Whitelist Management */}
                        <div className="bg-white rounded-2xl shadow-lg p-6">
                            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <PersonIcon className="w-5 h-5 text-cyan-500" />
                                Manage Access ({whitelist.length})
                            </h2>

                            {/* Add New Guest */}
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Approve New Guest
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newAddress}
                                        onChange={(e) => setNewAddress(e.target.value)}
                                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-gray-900"
                                        placeholder="0x123abc..."
                                    />
                                    <button
                                        onClick={() => {
                                            if (validateSuiAddress(newAddress)) {
                                                handleApproveGuest(newAddress.trim());
                                                setNewAddress('');
                                            }
                                        }}
                                        disabled={loading}
                                        className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50"
                                    >
                                        <CheckIcon className="w-5 h-5" />
                                    </button>
                                </div>
                                {addressError && (
                                    <p className="text-xs text-red-500 mt-1">{addressError}</p>
                                )}
                            </div>

                            {/* Current Whitelist */}
                            <div className="space-y-2 max-h-96 overflow-y-auto">
                                {whitelist.length === 0 ? (
                                    <div className="text-center py-8 text-gray-400">
                                        <PersonIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                        <p className="text-sm">No participants</p>
                                    </div>
                                ) : (
                                    whitelist.map((item, index) => (
                                        <div
                                            key={index}
                                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                                        >
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-cyan-500 rounded-full flex items-center justify-center flex-shrink-0">
                                                    <CheckIcon className="w-4 h-4 text-white" />
                                                </div>
                                                <span className="text-sm font-mono text-gray-700 truncate">
                                                    {item.address}
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => handleRevokeGuest(item.address)}
                                                disabled={loading}
                                                className="px-3 py-1 text-xs text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                                            >
                                                Revoke
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Room Info */}
                    <div className="mt-6 bg-white rounded-2xl shadow-lg p-6">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">Room Information</h2>
                        <div className="grid md:grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="text-gray-500">Require Approval:</span>
                                <span className="ml-2 font-medium">
                                    {roomData?.require_approval ? 'Yes' : 'No'}
                                </span>
                            </div>
                            <div>
                                <span className="text-gray-500">Participants:</span>
                                <span className="ml-2 font-medium">{whitelist.length}</span>
                            </div>
                            <div className="md:col-span-2">
                                <span className="text-gray-500">Policy Updated:</span>
                                <span className="ml-2 font-medium">
                                    {roomData?.seal_policy?.fields?.updated_at 
                                        ? new Date(Number(roomData.seal_policy.fields.updated_at)).toLocaleString()
                                        : 'N/A'
                                    }
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return null;
}

// Wrap component in Suspense for Next.js 15 useSearchParams requirement
export default function RoomPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 flex items-center justify-center">
                <div className="text-center">
                    <UpdateIcon className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
                    <p className="text-gray-600">Loading...</p>
                </div>
            </div>
        }>
            <RoomPageContent />
        </Suspense>
    );
}
