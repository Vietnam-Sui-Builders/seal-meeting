
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeftIcon, GlobeIcon, CardStackIcon, UpdateIcon, LockClosedIcon, LightningBoltIcon, ExclamationTriangleIcon, FrameIcon } from '@radix-ui/react-icons';
import { ConnectButton, ConnectModal, useCurrentAccount, useWallets } from '@mysten/dapp-kit';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
    const [error, setError] = useState('');
    const [openWallet, setOpenWallet] = useState(false);
    const router = useRouter();

    const currentAccount = useCurrentAccount();
    const wallets = useWallets();
    const { loginWithZkLogin, isAuthenticated } = useAuth();

    // Check if wallets are available
    const hasWallets = wallets && wallets.length > 0;

    // Redirect to room creation after wallet connection
    useEffect(() => {
        if (currentAccount) {
            router.push('/room');
        }
    }, [currentAccount, router]);

    // Also redirect if already authenticated
    useEffect(() => {
        if (isAuthenticated) {
            router.push('/room');
        }
    }, [isAuthenticated, router]);

    const handleZkLogin = () => {
        try {
            loginWithZkLogin();
        } catch (err) {
            setError('Failed to initiate Google login');
            console.error(err);
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Back Button */}
                <div className="mb-8">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
                    >
                        <ArrowLeftIcon className="w-4 h-4" />
                        <span className="text-sm font-medium">Back to Home</span>
                    </Link>
                </div>

                {/* Main Card */}
                <div className="bg-gray-800 rounded-2xl shadow-xl p-8">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl mb-6">
                            <span className="text-white text-2xl font-bold">S</span>
                        </div>
                        <h1 className="text-3xl font-bold text-white mb-2">
                            Welcome to SuiMeet
                        </h1>
                        <p className="text-gray-300">
                            Connect your wallet to start creating secure, decentralized meetings
                        </p>
                    </div>

                    {/* Login Options */}
                    <div className="space-y-4 mb-8">
                        {/* zkLogin Button */}
                        <button
                            onClick={handleZkLogin}
                            className="w-full group relative overflow-hidden bg-gray-700 border-2 border-gray-600 rounded-xl p-4 hover:bg-gray-600 hover:border-gray-500 transition-all duration-200"
                        >
                            <div className="flex items-center justify-center gap-4">
                                <div className="flex-shrink-0 w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center group-hover:bg-red-100 transition-colors">
                                    <GlobeIcon className="w-6 h-6 text-red-500" />
                                </div>
                                <div className="text-left">
                                    <h3 className="font-semibold text-white mb-1">
                                        {'Continue with Google'}
                                    </h3>
                                </div>
                            </div>
                        </button>

                        {/* Wallet Connect Button */}
                        <ConnectModal
                            trigger={
                                <button className="w-full">
                                    <div className="w-full items-center flex justify-center border-2 border-gray-600 rounded-xl p-4 bg-gray-700 hover:bg-gray-600 transition-colors gap-4">
                                        <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center group-hover:bg-red-100 transition-colors">
                                            <FrameIcon className="w-6 h-6 text-red-500" />
                                        </div>
                                        <div className="text-white">
                                            Connect Wallet
                                        </div>
                                    </div>
                                </button>
                            }
                            open={openWallet}
                            onOpenChange={(isOpen) => setOpenWallet(isOpen)}
                        />
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                            <p className="text-sm text-red-600 text-center">{error}</p>
                        </div>
                    )}

                    {/* Features Preview */}
                    <div className="space-y-4 pt-6 border-t border-gray-700">
                        <h4 className="text-sm font-semibold text-white mb-3">
                            What you'll get:
                        </h4>
                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                                    <LockClosedIcon className="w-4 h-4 text-blue-500" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-white">Secure Meetings</p>
                                    <p className="text-xs text-gray-400">End-to-end encrypted with blockchain security</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-cyan-50 rounded-lg flex items-center justify-center">
                                    <LightningBoltIcon className="w-4 h-4 text-cyan-500" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-white">NFT Attendance Badges</p>
                                    <p className="text-xs text-gray-400">Mint POAPs for meeting participation</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="text-center mt-8">
                    <p className="text-xs text-gray-400">
                        By connecting, you agree to our Terms of Service and Privacy Policy
                    </p>
                </div>
            </div>
        </div>
    );
}