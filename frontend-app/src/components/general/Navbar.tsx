'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import ConnectWalletModal from './ConnectWalletModal';

export default function Navbar() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isConnected, setIsConnected] = useState(false);

    const handleConnect = () => {
        setIsModalOpen(true);
    };

    const handleDisconnect = () => {
        setIsConnected(false);
        // TODO: Implement actual disconnect logic
    };

    return (
        <>
            <nav className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-50">
                <div className="container mx-auto px-4">
                    <div className="flex items-center justify-between h-16">
                        {/* Logo */}
                        <Link href="/" className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold text-lg">S</span>
                            </div>
                            <span className="text-xl font-bold text-gray-900">
                                Sui File Upload
                            </span>
                        </Link>

                        {/* Desktop Navigation */}
                        <div className="hidden md:flex items-center gap-8">
                            <Link
                                href="/"
                                className="text-gray-600 hover:text-gray-900 transition-colors"
                            >
                                Home
                            </Link>
                            <Link
                                href="#features"
                                className="text-gray-600 hover:text-gray-900 transition-colors"
                            >
                                Features
                            </Link>
                            <Link
                                href="#docs"
                                className="text-gray-600 hover:text-gray-900 transition-colors"
                            >
                                Documentation
                            </Link>
                        </div>

                        {/* Connect Wallet Button */}
                        <div className="hidden md:block">
                            {isConnected ? (
                                <div className="flex items-center gap-3">
                                    <div className="px-4 py-2 bg-green-50 border border-green-200 rounded-lg">
                                        <span className="text-sm font-medium text-green-700">
                                            0x1234...5678
                                        </span>
                                    </div>
                                    <button
                                        onClick={handleDisconnect}
                                        className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
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
                            className="md:hidden p-2 text-gray-600 hover:text-gray-900"
                        >
                            {isMobileMenuOpen ? (
                                <X className="w-6 h-6" />
                            ) : (
                                <Menu className="w-6 h-6" />
                            )}
                        </button>
                    </div>

                    {/* Mobile Menu */}
                    {isMobileMenuOpen && (
                        <div className="md:hidden py-4 border-t border-gray-200">
                            <div className="flex flex-col gap-4">
                                <Link
                                    href="/"
                                    className="text-gray-600 hover:text-gray-900 transition-colors"
                                >
                                    Home
                                </Link>
                                <Link
                                    href="#features"
                                    className="text-gray-600 hover:text-gray-900 transition-colors"
                                >
                                    Features
                                </Link>
                                <Link
                                    href="#docs"
                                    className="text-gray-600 hover:text-gray-900 transition-colors"
                                >
                                    Documentation
                                </Link>
                                {isConnected ? (
                                    <>
                                        <div className="px-4 py-2 bg-green-50 border border-green-200 rounded-lg">
                                            <span className="text-sm font-medium text-green-700">
                                                0x1234...5678
                                            </span>
                                        </div>
                                        <button
                                            onClick={handleDisconnect}
                                            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors text-left"
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

            {/* Connect Wallet Modal */}
            <ConnectWalletModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onConnect={(method) => {
                    setIsConnected(true);
                    setIsModalOpen(false);
                    console.log('Connected via:', method);
                }}
            />
        </>
    );
}
