'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface LoadingContextType {
    isLoading: boolean;
    startLoading: () => void;
    stopLoading: () => void;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export function LoadingProvider({ children }: { children: ReactNode }) {
    const [isLoading, setIsLoading] = useState(false);

    const startLoading = () => setIsLoading(true);
    const stopLoading = () => setIsLoading(false);

    return (
        <LoadingContext.Provider value={{ isLoading, startLoading, stopLoading }}>
            {children}
            {isLoading && <LoadingOverlay />}
        </LoadingContext.Provider>
    );
}

export function useLoading() {
    const context = useContext(LoadingContext);
    if (context === undefined) {
        throw new Error('useLoading must be used within a LoadingProvider');
    }
    return context;
}

function LoadingOverlay() {
    return (
        <div 
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
            style={{ pointerEvents: 'all' }}
        >
            <div className="bg-gray-800 rounded-2xl p-8 shadow-2xl border border-gray-700">
                {/* Spinner */}
                <div className="flex flex-col items-center gap-4">
                    <div className="relative w-16 h-16">
                        {/* Outer spinning ring */}
                        <div className="absolute inset-0 border-4 border-blue-500/30 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-transparent border-t-blue-500 rounded-full animate-spin"></div>
                        
                        {/* Inner spinning ring */}
                        <div className="absolute inset-2 border-4 border-cyan-500/30 rounded-full"></div>
                        <div className="absolute inset-2 border-4 border-transparent border-t-cyan-500 rounded-full animate-spin animation-delay-150" style={{ animationDirection: 'reverse' }}></div>
                    </div>
                    
                    {/* Loading text */}
                    <div className="flex flex-col items-center gap-2">
                        <p className="text-white font-semibold text-lg">Loading...</p>
                        <p className="text-gray-400 text-sm">Please wait</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
