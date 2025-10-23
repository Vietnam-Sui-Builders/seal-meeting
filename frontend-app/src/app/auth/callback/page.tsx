'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
    parseJwtFromUrl, 
    decodeJwt, 
    retrieveZkLoginState, 
    clearZkLoginState 
} from '@/lib/zkLogin';
import { saveZkLoginUser } from '@/context/AuthContext';
import { useLoading } from '@/context/LoadingContext';

export default function AuthCallbackPage() {
    const router = useRouter();
    const { startLoading, stopLoading } = useLoading();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        handleCallback();
    }, []);

    const handleCallback = async () => {
        startLoading();
        
        try {
            // Parse JWT from URL
            const jwt = parseJwtFromUrl();
            if (!jwt) {
                throw new Error('No JWT token found in callback');
            }

            // Decode JWT
            const decodedJwt = decodeJwt(jwt);
            console.log('Decoded JWT:', decodedJwt);

            // Retrieve stored zkLogin state
            const zkLoginState = retrieveZkLoginState();
            if (!zkLoginState) {
                throw new Error('No zkLogin state found. Please try logging in again.');
            }

            // TODO: Generate zkLogin proof and derive address
            // This requires calling the zkLogin prover service with:
            // - JWT token
            // - randomness
            // - maxEpoch
            // For now, we'll use a placeholder address
            const placeholderAddress = `0x${decodedJwt.sub.slice(0, 40)}`;

            // Save user data to localStorage
            saveZkLoginUser(decodedJwt, placeholderAddress);

            // Clear zkLogin state from session storage
            clearZkLoginState();

            // Small delay to ensure localStorage is written
            await new Promise(resolve => setTimeout(resolve, 100));

            // Redirect to home - this will trigger the context to reload from localStorage
            window.location.href = '/';
        } catch (err) {
            console.error('zkLogin callback error:', err);
            setError(err instanceof Error ? err.message : 'Failed to complete login');
            stopLoading();
        }
    };

    if (error) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
                <div className="bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full">
                    <div className="text-center">
                        <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-red-500 text-3xl">✕</span>
                        </div>
                        <h1 className="text-2xl font-bold text-white mb-2">
                            Login Failed
                        </h1>
                        <p className="text-gray-400 mb-6">
                            {error}
                        </p>
                        <button
                            onClick={() => router.push('/login')}
                            className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center">
            <div className="text-center">
                <h1 className="text-2xl font-bold text-white">
                    Completing login...
                </h1>
            </div>
        </div>
    );
}
