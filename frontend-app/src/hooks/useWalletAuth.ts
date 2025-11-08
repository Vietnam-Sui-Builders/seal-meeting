import { useState, useCallback } from 'react';
import { useCurrentAccount, useSignPersonalMessage } from '@mysten/dapp-kit';
import { apiClient } from '@/lib/api';

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

interface UseWalletAuthReturn {
  isAuthenticating: boolean;
  error: string | null;
  authenticate: () => Promise<AuthTokens | null>;
  clearError: () => void;
}

/**
 * Hook for authenticating a connected wallet using nonce-based challenge
 */
export function useWalletAuth(): UseWalletAuthReturn {
  const currentAccount = useCurrentAccount();
  const { mutateAsync: signPersonalMessage } = useSignPersonalMessage();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const authenticate = useCallback(async (): Promise<AuthTokens | null> => {
    if (!currentAccount) {
      setError('No wallet connected');
      return null;
    }

    setIsAuthenticating(true);
    setError(null);

    try {
      // Step 1: Request nonce from backend
      console.log('Requesting nonce for wallet:', currentAccount.address);
      const { nonce, expiresAt } = await apiClient.getNonce(currentAccount.address);

      console.log('Received nonce:', nonce);

      // Step 2: Create message to sign
      const message = `Sign this message to authenticate with SuiMeet.\n\nNonce: ${nonce}\nWallet: ${currentAccount.address}\nExpires: ${new Date(expiresAt).toISOString()}`;

      // Step 3: Sign the message with the wallet
      console.log('Requesting signature from wallet...');
      const { signature } = await signPersonalMessage({
        message: new TextEncoder().encode(message),
      });

      console.log('Signature received:', signature);

      // Step 4: Verify signature with backend
      console.log('Verifying signature with backend...');
      const response = await apiClient.verifySignature(
        currentAccount.address,
        signature,
        'sui'
      );

      console.log('Authentication successful');

      // Step 5: Store tokens
      const tokens = {
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
        expiresAt: response.session.expiresAt,
      };

      // Store in localStorage
      localStorage.setItem('accessToken', tokens.accessToken);
      localStorage.setItem('refreshToken', tokens.refreshToken);
      localStorage.setItem('tokenExpiresAt', tokens.expiresAt);

      setIsAuthenticating(false);
      return tokens;
    } catch (err) {
      console.error('Authentication error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Authentication failed';
      setError(errorMessage);
      setIsAuthenticating(false);
      return null;
    }
  }, [currentAccount, signPersonalMessage]);

  return {
    isAuthenticating,
    error,
    authenticate,
    clearError,
  };
}
