'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { useCurrentAccount, useDisconnectWallet, useSuiClientQuery } from '@mysten/dapp-kit';

interface WalletContextType {
    account: ReturnType<typeof useCurrentAccount>;
    isConnected: boolean;
    address: string | null;
    balance: string | null;
    disconnect: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletContextProvider({ children }: { children: ReactNode }) {
    const account = useCurrentAccount();
    const { mutate: disconnect } = useDisconnectWallet();

    // Get balance for connected wallet
    const { data: balanceData, isPending, isError, error, refetch } = useSuiClientQuery(
        'getBalance',
        { owner: account?.address || '' },
        { enabled: !!account?.address }
    );

    const isConnected = !!account;
    const address = account?.address || null;
    const balance = balanceData?.totalBalance
        ? (Number(balanceData.totalBalance) / 1_000_000_000).toFixed(4) // Convert MIST to SUI
        : null;

    return (
        <WalletContext.Provider
            value={{
                account,
                isConnected,
                address,
                balance,
                disconnect,
            }}
        >
            {children}
        </WalletContext.Provider>
    );
}

export function useWallet() {
    const context = useContext(WalletContext);
    if (context === undefined) {
        throw new Error('useWallet must be used within a WalletContextProvider');
    }
    return context;
}
