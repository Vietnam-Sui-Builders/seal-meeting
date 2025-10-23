'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { HamburgerMenuIcon, Cross2Icon } from '@radix-ui/react-icons';
import { useAuth } from '@/context/AuthContext';

export default function Navbar() {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const router = useRouter();
    const { isAuthenticated, address, disconnect } = useAuth();

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
            <nav className="fixed top-0 left-0 right-0 bg-gray-900 border-b border-gray-800 z-50">
                <div className="container mx-auto px-4">
                    <div className="flex items-center justify-between h-16">
                        {/* Logo */}
                        <Link href="/" className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold text-lg">S</span>
                            </div>
                            <span className="text-xl font-bold text-white">
                                Sui File Upload
                            </span>
                        </Link>

                        {/* Desktop Navigation */}
                        <div className="hidden md:flex items-center gap-8">
                            <Link
                                href="/"
                                className="text-gray-300 hover:text-white transition-colors"
                            >
                                Home
                            </Link>
                            <Link
                                href="#features"
                                className="text-gray-300 hover:text-white transition-colors"
                            >
                                Features
                            </Link>
                            <Link
                                href="#docs"
                                className="text-gray-300 hover:text-white transition-colors"
                            >
                                Documentation
                            </Link>
                        </div>

                        {/* Connect Wallet Button */}
                        <div className="hidden md:block">
                            {isAuthenticated && address ? (
                                <div className="flex items-center gap-3">
                                    <Link 
                                        href="/wallet"
                                        className="px-4 py-2 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
                                    >
                                        <span className="text-sm font-medium text-green-700">
                                            {formatAddress(address)}
                                        </span>
                                    </Link>
                                    <button
                                        onClick={handleDisconnect}
                                        className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
                                    >
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
                        </div>

                        {/* Mobile Menu Button */}
                        <button
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className="md:hidden p-2 text-gray-300 hover:text-white"
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
                        <div className="md:hidden py-4 border-t border-gray-800">
                            <div className="flex flex-col gap-4">
                                <Link
                                    href="/"
                                    className="text-gray-300 hover:text-white transition-colors"
                                >
                                    Home
                                </Link>
                                <Link
                                    href="#features"
                                    className="text-gray-300 hover:text-white transition-colors"
                                >
                                    Features
                                </Link>
                                <Link
                                    href="#docs"
                                    className="text-gray-300 hover:text-white transition-colors"
                                >
                                    Documentation
                                </Link>
                                {isAuthenticated && address ? (
                                    <>
                                        <Link 
                                            href="/wallet"
                                            className="px-4 py-2 bg-green-50 border border-green-200 rounded-lg"
                                        >
                                            <span className="text-sm font-medium text-green-700">
                                                {formatAddress(address)}
                                            </span>
                                        </Link>
                                        <button
                                            onClick={handleDisconnect}
                                            className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors text-left"
                                        >
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
                            </div>
                        </div>
                    )}
                </div>
            </nav>
        </>
    );
}
