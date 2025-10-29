'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { HamburgerMenuIcon, Cross2Icon, PlusIcon, ExitIcon, UpdateIcon } from '@radix-ui/react-icons';
import { useCurrentAccount, useDisconnectWallet } from '@mysten/dapp-kit';
import { useAuth } from '@/context/AuthContext';

export default function Navbar() {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const router = useRouter();
    const currentAccount = useCurrentAccount();
    const { mutate: disconnect } = useDisconnectWallet();
    const { isConnecting } = useAuth();

    const handleConnect = () => {
        router.push('/login');
    };

    const handleDisconnect = () => {
        disconnect();
        router.push('/');
    };

    // Format address for display
    const formatAddress = (addr: string) => {
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    };

    return (
        <>
            <nav className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 shadow-sm z-50">
                <div className="container mx-auto px-4">
                    <div className="flex items-center justify-between h-16">
                        {/* Logo */}
                        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-md">
                                <span className="text-white font-bold text-xl">S</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-xl font-bold text-gray-900 leading-tight">
                                    SuiMeet
                                </span>
                                <span className="text-xs text-gray-500 leading-tight">
                                    Secure Meetings
                                </span>
                            </div>
                        </Link>

                        {/* Desktop Navigation */}
                        <div className="hidden md:flex items-center gap-4">
                            {isConnecting ? (
                                <div className="flex items-center gap-3">
                                    <div className="px-4 py-2 bg-gray-100 rounded-lg">
                                        <UpdateIcon className="w-4 h-4 text-gray-500 animate-spin" />
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {currentAccount && (
                                        <Link
                                            href="/room"
                                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg font-medium hover:shadow-lg transition-all duration-200"
                                        >
                                            <PlusIcon className="w-4 h-4" />
                                            Create Room
                                        </Link>
                                    )}
                                    
                                    {currentAccount ? (
                                        <div className="flex items-center gap-3">
                                            <div className="px-4 py-2 bg-green-50 border border-green-200 rounded-lg">
                                                <span className="text-sm font-medium text-green-700">
                                                    {formatAddress(currentAccount.address)}
                                                </span>
                                            </div>
                                            <button
                                                onClick={handleDisconnect}
                                                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Disconnect Wallet"
                                            >
                                                <ExitIcon className="w-4 h-4" />
                                                Disconnect
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={handleConnect}
                                            className="px-6 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg font-medium hover:shadow-lg transition-all duration-200"
                                        >
                                            Connect Wallet
                                        </button>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Mobile Menu Button */}
                        <button
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className="md:hidden p-2 text-gray-600 hover:text-gray-900"
                        >
                            {isMobileMenuOpen ? (
                                <Cross2Icon className="w-6 h-6" />
                            ) : (
                                <HamburgerMenuIcon className="w-6 h-6" />
                            )}
                        </button>
                    </div>

                    {/* Mobile Menu */}
                    {isMobileMenuOpen && (
                        <div className="md:hidden py-4 border-t border-gray-200">
                            <div className="flex flex-col gap-3">
                                {isConnecting ? (
                                    <div className="flex items-center justify-center gap-2 px-4 py-2 text-gray-500">
                                        <UpdateIcon className="w-4 h-4 animate-spin" />
                                        <span className="text-sm">Connecting...</span>
                                    </div>
                                ) : (
                                    <>
                                        {currentAccount && (
                                            <Link
                                                href="/room"
                                                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg font-medium hover:shadow-lg transition-all duration-200"
                                                onClick={() => setIsMobileMenuOpen(false)}
                                            >
                                                <PlusIcon className="w-4 h-4" />
                                                Create Room
                                            </Link>
                                        )}
                                        
                                        {currentAccount ? (
                                            <>
                                                <div className="px-4 py-2 bg-green-50 border border-green-200 rounded-lg">
                                                    <span className="text-sm font-medium text-green-700">
                                                        {formatAddress(currentAccount.address)}
                                                    </span>
                                                </div>
                                                <button
                                                    onClick={handleDisconnect}
                                                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                >
                                                    <ExitIcon className="w-4 h-4" />
                                                    Disconnect
                                                </button>
                                            </>
                                        ) : (
                                            <button
                                                onClick={handleConnect}
                                                className="px-6 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg font-medium hover:shadow-lg transition-all duration-200"
                                            >
                                                Connect Wallet
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </nav>
        </>
    );
}
