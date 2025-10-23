'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { ArrowLeftIcon, CopyIcon, ExitIcon, CheckIcon } from '@radix-ui/react-icons';
import Link from 'next/link';

export default function WalletPage() {
    const router = useRouter();
    const { isAuthenticated, address, balance, disconnect, authMethod, user } = useAuth();
    const [copied, setCopied] = React.useState(false);

    React.useEffect(() => {
        if (!isAuthenticated) {
            router.push('/login');
        }
    }, [isAuthenticated, router]);

    const handleCopyAddress = () => {
        if (address) {
            navigator.clipboard.writeText(address);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleDisconnect = () => {
        disconnect();
        router.push('/');
    };

    if (!isAuthenticated) {
        return null;
    }

    const shortenAddress = (addr: string) => {
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 p-4">
            <div className="max-w-4xl mx-auto pt-8">
                {/* Back Button */}
                <div className="mb-8">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
                    >
                        <ArrowLeftIcon className="w-4 h-4" />
                        <span className="text-sm font-medium">Back to Home</span>
                    </Link>
                </div>

                {/* Main Card */}
                <div className="bg-white rounded-2xl shadow-xl p-8">
                    {/* Header */}
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">
                            Wallet Info
                        </h1>
                        <p className="text-gray-500">
                            View your wallet details and manage your connection
                        </p>
                        <div className="mt-2">
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {authMethod === 'zklogin' ? '🔐 zkLogin (Google)' : '💼 Wallet Provider'}
                            </span>
                        </div>
                    </div>

                    {/* Wallet Details */}
                    <div className="space-y-6">
                        {/* Address */}
                        <div className="border border-gray-200 rounded-xl p-6">
                            <label className="text-sm font-semibold text-gray-600 mb-2 block">
                                Wallet Address
                            </label>
                            <div className="flex items-center gap-3">
                                <code className="flex-1 text-sm bg-gray-50 px-4 py-3 rounded-lg font-mono text-gray-900">
                                    {address}
                                </code>
                                <button
                                    onClick={handleCopyAddress}
                                    className="p-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                                    title="Copy address"
                                >
                                    {copied ? (
                                        <CheckIcon className="w-5 h-5 text-green-600" />
                                    ) : (
                                        <CopyIcon className="w-5 h-5 text-blue-600" />
                                    )}
                                </button>
                            </div>
                            <p className="text-xs text-gray-500 mt-2">
                                Shortened: {address && shortenAddress(address)}
                            </p>
                        </div>

                        {/* Balance */}
                        <div className="border border-gray-200 rounded-xl p-6">
                            <label className="text-sm font-semibold text-gray-600 mb-2 block">
                                SUI Balance
                            </label>
                            <div className="flex items-baseline gap-2">
                                <span className="text-4xl font-bold text-gray-900">
                                    {balance || '0.0000'}
                                </span>
                                <span className="text-lg text-gray-500">SUI</span>
                            </div>
                        </div>

                        {/* Connection Status */}
                        <div className="border border-gray-200 rounded-xl p-6">
                            <label className="text-sm font-semibold text-gray-600 mb-2 block">
                                Connection Status
                            </label>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                                <span className="text-sm font-medium text-gray-900">
                                    Connected
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-8 pt-6 border-t border-gray-200">
                        <button
                            onClick={handleDisconnect}
                            className="w-full flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 font-semibold py-3 px-6 rounded-xl transition-colors"
                        >
                            <ExitIcon className="w-4 h-4" />
                            Disconnect Wallet
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
