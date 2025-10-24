// app/providers.tsx
'use client';

import { SuiClientProvider, WalletProvider } from '@mysten/dapp-kit';
import { getFullnodeUrl } from '@mysten/sui.js/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();
const networks = {
    mainnet: { url: getFullnodeUrl('mainnet') },
    testnet: { url: getFullnodeUrl('testnet') },
};

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!}>
            <QueryClientProvider client={queryClient}>
                <SuiClientProvider networks={networks} defaultNetwork="testnet">
                    <WalletProvider autoConnect>
                        {children}
                    </WalletProvider>
                </SuiClientProvider>
            </QueryClientProvider>
        </GoogleOAuthProvider>
    );
}