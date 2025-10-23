'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useCurrentAccount, useDisconnectWallet, useSuiClientQuery } from '@mysten/dapp-kit';
import { initiateZkLogin, DecodedJwt } from '@/lib/zkLogin';

export type AuthMethod = 'wallet' | 'zklogin' | null;

interface AuthContextType {
    // Common properties
    isAuthenticated: boolean;
    address: string | null;
    balance: string | null;
    authMethod: AuthMethod;
    
    // User info (for zkLogin)
    user: DecodedJwt | null;
    
    // Actions
    loginWithZkLogin: () => void;
    disconnect: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const walletAccount = useCurrentAccount();
    const { mutate: disconnectWallet } = useDisconnectWallet();
    const [zkUser, setZkUser] = useState<DecodedJwt | null>(null);
    const [zkAddress, setZkAddress] = useState<string | null>(null);

    // Determine which auth method is active
    const authMethod: AuthMethod = walletAccount 
        ? 'wallet' 
        : zkUser 
        ? 'zklogin' 
        : null;

    // Get the active address
    const address = walletAccount?.address || zkAddress;

    // Get balance for the active address
    const { data: balanceData } = useSuiClientQuery(
        'getBalance',
        { owner: address || '' },
        { enabled: !!address }
    );

    const balance = balanceData?.totalBalance 
        ? (Number(balanceData.totalBalance) / 1_000_000_000).toFixed(4)
        : null;

    // Load zkLogin user from localStorage on mount
    useEffect(() => {
        const storedUser = localStorage.getItem('zkLoginUser');
        const storedAddress = localStorage.getItem('zkLoginAddress');
        
        if (storedUser && storedAddress) {
            try {
                setZkUser(JSON.parse(storedUser));
                setZkAddress(storedAddress);
            } catch (error) {
                console.error('Failed to parse stored zkLogin user:', error);
                localStorage.removeItem('zkLoginUser');
                localStorage.removeItem('zkLoginAddress');
            }
        }
    }, []);

    // Actions
    const loginWithZkLogin = () => {
        initiateZkLogin();
    };

    const disconnect = () => {
        // Disconnect wallet if connected
        if (walletAccount) {
            disconnectWallet();
        }
        
        // Clear zkLogin data
        setZkUser(null);
        setZkAddress(null);
        localStorage.removeItem('zkLoginUser');
        localStorage.removeItem('zkLoginAddress');
    };

    const isAuthenticated = !!address;

    return (
        <AuthContext.Provider 
            value={{
                isAuthenticated,
                address,
                balance,
                authMethod,
                user: zkUser,
                loginWithZkLogin,
                disconnect,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

// Helper function to save zkLogin user (called from callback page)
export function saveZkLoginUser(user: DecodedJwt, address: string): void {
    localStorage.setItem('zkLoginUser', JSON.stringify(user));
    localStorage.setItem('zkLoginAddress', address);
}
