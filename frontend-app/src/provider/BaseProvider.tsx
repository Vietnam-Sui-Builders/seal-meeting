// app/providers.tsx
'use client';

import { SuiClientProvider, WalletProvider, createNetworkConfig, lightTheme } from '@mysten/dapp-kit';
import { getFullnodeUrl } from '@mysten/sui.js/client';
import { Theme } from '@radix-ui/themes';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LoadingProvider } from '@/context/LoadingContext';
import { AuthProvider } from '@/context/AuthContext';



// Configure QueryClient with error handling
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: 2,
            staleTime: 1000 * 60 * 5, // 5 minutes
            refetchOnWindowFocus: false,
        },
    },
});

// Configure networks using createNetworkConfig
const { networkConfig } = createNetworkConfig({
    localnet: { url: getFullnodeUrl('localnet') },
    devnet: { url: getFullnodeUrl('devnet') },
    testnet: { url: getFullnodeUrl('testnet') },
    mainnet: { url: getFullnodeUrl('mainnet') },
});


export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''}>
            <QueryClientProvider client={queryClient}>
                <SuiClientProvider networks={networkConfig} defaultNetwork="testnet">
                    <WalletProvider
                        theme={lightTheme}
                        autoConnect={false}
                        enableUnsafeBurner={process.env.NODE_ENV === 'development'}
                        storageKey="sui-meet-wallet"
                    >
                        <AuthProvider>
                            <LoadingProvider>
                                <Theme>
                                    {children}
                                </Theme>
                            </LoadingProvider>
                        </AuthProvider>
                    </WalletProvider>
                </SuiClientProvider>
            </QueryClientProvider>
        </GoogleOAuthProvider>
    );
}
