
'use client';

import React, { useState } from 'react';
import { X, Wallet, Chrome, Loader2 } from 'lucide-react';
import { ConnectWalletModalProps } from '@/@types/props/ConnectWalletModalProps';



export default function ConnectWalletModal({
    isOpen,
    onClose,
    onConnect
}: ConnectWalletModalProps) {
    const [isZkLoading, setIsZkLoading] = useState(false);
    const [isWalletLoading, setIsWalletLoading] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleZkLogin = async () => {
        setIsZkLoading(true);
        setError('');
        try {
            // TODO: Implement @mysten/zklogin integration
            await new Promise(resolve => setTimeout(resolve, 1500));
            onConnect('zklogin');
        } catch (err) {
            setError('Failed to authenticate with Google');
            console.error(err);
        } finally {
            setIsZkLoading(false);
        }
    };

    const handleWalletConnect = async () => {
        setIsWalletLoading(true);
        setError('');
        try {
            // TODO: Implement @mysten/dapp-kit wallet connection
            await new Promise(resolve => setTimeout(resolve, 1500));
            onConnect('wallet');
        } catch (err) {
            setError('Failed to connect wallet');
            console.error(err);
        } finally {
            setIsWalletLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
            <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Modal Content */}
                <div className="p-8">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl mb-4">
                            <span className="text-white text-2xl font-bold">S</span>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">
                            Connect to Sui
                        </h2>
                        <p className="text-gray-500 text-sm">
                            Choose your preferred connection method
                        </p>
                    </div>

                    {/* Login Options */}
                    <div className="space-y-4">
                        {/* zkLogin Button */}
                        <button
                            onClick={handleZkLogin}
                            disabled={isZkLoading || isWalletLoading}
                            className="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-white border-2 border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
                        >
                            {isZkLoading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <Chrome className="w-5 h-5" />
                            )}
                            <span>
                                {isZkLoading ? 'Connecting...' : 'Continue with Google'}
                            </span>
                        </button>

                        {/* Divider */}
                        <div className="relative flex items-center py-2">
                            <div className="flex-grow border-t border-gray-200"></div>
                            <span className="flex-shrink mx-4 text-gray-400 text-sm font-medium">
                                OR
                            </span>
                            <div className="flex-grow border-t border-gray-200"></div>
                        </div>

                        {/* Wallet Connect Button */}
                        <button
                            onClick={handleWalletConnect}
                            disabled={isZkLoading || isWalletLoading}
                            className="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl font-medium text-white hover:from-blue-600 hover:to-cyan-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
                        >
                            {isWalletLoading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <Wallet className="w-5 h-5" />
                            )}
                            <span>
                                {isWalletLoading ? 'Connecting...' : 'Connect Sui Wallet'}
                            </span>
                        </button>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-sm text-red-600 text-center">{error}</p>
                        </div>
                    )}

                    {/* Info Section */}
                    <div className="mt-8 pt-6 border-t border-gray-100">
                        <div className="space-y-3 text-xs text-gray-500">
                            <div className="flex items-start gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 flex-shrink-0"></div>
                                <p>
                                    <span className="font-semibold text-gray-700">zkLogin:</span> Sign in with Google using zero-knowledge proofs
                                </p>
                            </div>
                            <div className="flex items-start gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 mt-1.5 flex-shrink-0"></div>
                                <p>
                                    <span className="font-semibold text-gray-700">Wallet:</span> Connect Sui Wallet, Suiet, Ethos, or other compatible wallets
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}