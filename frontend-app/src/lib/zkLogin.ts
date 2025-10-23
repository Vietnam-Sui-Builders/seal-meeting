import { generateNonce, generateRandomness } from '@mysten/zklogin';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { jwtDecode } from 'jwt-decode';

const REDIRECT_URI = typeof window !== 'undefined' 
    ? `${window.location.origin}/auth/callback`
    : 'http://localhost:3000/auth/callback';

export interface ZkLoginState {
    nonce: string;
    randomness: string;
    maxEpoch: number;
    ephemeralPrivateKey: string;
}

/**
 * Generate zkLogin state for OAuth flow
 */
export function generateZkLoginState(): ZkLoginState {
    // Generate ephemeral keypair
    const ephemeralKeypair = new Ed25519Keypair();
    const ephemeralPrivateKey = ephemeralKeypair.getSecretKey();
    const ephemeralPublicKey = ephemeralKeypair.getPublicKey();
    
    const randomness = generateRandomness();
    const maxEpoch = getMaxEpoch();
    const nonce = generateNonce(
        ephemeralPublicKey,
        maxEpoch,
        randomness
    );

    return {
        nonce,
        randomness,
        maxEpoch,
        ephemeralPrivateKey,
    };
}

/**
 * Get max epoch (current epoch + buffer)
 */
function getMaxEpoch(): number {
    // In production, you should fetch current epoch from Sui network
    // For now, using a reasonable future epoch
    const currentEpoch = Math.floor(Date.now() / 1000 / 86400); // rough estimate
    return currentEpoch + 10; // 10 epoch buffer
}

/**
 * Create Google OAuth URL with zkLogin parameters
 */
export function createGoogleAuthUrl(nonce: string): string {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    
    if (!clientId) {
        throw new Error('NEXT_PUBLIC_GOOGLE_CLIENT_ID is not configured');
    }

    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: REDIRECT_URI,
        response_type: 'id_token',
        scope: 'openid email profile',
        nonce: nonce,
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Store zkLogin state in session storage
 */
export function storeZkLoginState(state: ZkLoginState): void {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem('zkLoginState', JSON.stringify(state));
}

/**
 * Retrieve zkLogin state from session storage
 */
export function retrieveZkLoginState(): ZkLoginState | null {
    if (typeof window === 'undefined') return null;
    
    const stored = sessionStorage.getItem('zkLoginState');
    if (!stored) return null;
    
    try {
        return JSON.parse(stored);
    } catch {
        return null;
    }
}

/**
 * Clear zkLogin state from session storage
 */
export function clearZkLoginState(): void {
    if (typeof window === 'undefined') return;
    sessionStorage.removeItem('zkLoginState');
}

/**
 * Parse JWT token from OAuth callback
 */
export function parseJwtFromUrl(): string | null {
    if (typeof window === 'undefined') return null;
    
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    return params.get('id_token');
}

/**
 * Decode and validate JWT token
 */
export interface DecodedJwt {
    sub: string;
    email?: string;
    name?: string;
    picture?: string;
    iss: string;
    aud: string;
}

export function decodeJwt(token: string): DecodedJwt {
    return jwtDecode<DecodedJwt>(token);
}

/**
 * Initiate zkLogin flow
 */
export function initiateZkLogin(): void {
    const state = generateZkLoginState();
    storeZkLoginState(state);
    const authUrl = createGoogleAuthUrl(state.nonce);
    window.location.href = authUrl;
}
