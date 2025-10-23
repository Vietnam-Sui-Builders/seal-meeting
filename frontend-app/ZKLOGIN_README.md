# zkLogin Implementation Documentation

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend Application                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                      AuthContext                          │  │
│  │  - Unified authentication state management                │  │
│  │  - Handles both zkLogin & Wallet Provider                 │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│              ┌───────────────┴───────────────┐                  │
│              │                               │                  │
│     ┌────────▼────────┐            ┌────────▼────────┐         │
│     │   zkLogin Path  │            │  Wallet Path    │         │
│     │  (Google OAuth) │            │  (Sui Wallet)   │         │
│     └────────┬────────┘            └────────┬────────┘         │
│              │                               │                  │
└──────────────┼───────────────────────────────┼──────────────────┘
               │                               │
               │                               │
        ┌──────▼───────┐              ┌───────▼────────┐
        │    Google    │              │  @mysten/      │
        │    OAuth     │              │  dapp-kit      │
        │   Provider   │              │                │
        └──────────────┘              └────────────────┘
```

---

## 📁 File Structure

```
src/
├── context/
│   ├── AuthContext.tsx          ⭐ Main unified auth context
│   └── LoadingContext.tsx       🔄 Global loading overlay
│
├── lib/
│   └── zkLogin.ts               🔐 zkLogin utility functions
│
├── app/
│   ├── login/
│   │   └── page.tsx             🚪 Login page (both methods)
│   ├── auth/
│   │   └── callback/
│   │       └── page.tsx         📞 OAuth callback handler
│   └── wallet/
│       └── page.tsx             💼 Wallet info page
│
└── components/
    └── general/
        └── Navbar.tsx           🧭 Navigation with auth status
```

---

## 🔄 zkLogin Flow Diagram

```
┌─────────────┐
│   User      │
│  Clicks     │
│  "Login     │
│  with       │
│  Google"    │
└──────┬──────┘
       │
       │ 1. Click handler
       ▼
┌──────────────────────────────────────────┐
│  loginWithZkLogin()                      │
│  (AuthContext)                           │
└──────┬───────────────────────────────────┘
       │
       │ 2. Call initiateZkLogin()
       ▼
┌──────────────────────────────────────────┐
│  lib/zkLogin.ts                          │
│  - Generate ephemeral keypair            │
│  - Generate nonce & randomness           │
│  - Store in sessionStorage               │
└──────┬───────────────────────────────────┘
       │
       │ 3. Redirect to Google
       ▼
┌──────────────────────────────────────────┐
│  Google OAuth                            │
│  - User authenticates                    │
│  - Google returns JWT token              │
└──────┬───────────────────────────────────┘
       │
       │ 4. Redirect to /auth/callback
       ▼
┌──────────────────────────────────────────┐
│  app/auth/callback/page.tsx              │
│  - Parse JWT from URL hash               │
│  - Retrieve stored zkLogin state         │
│  - Generate zkLogin proof (TODO)         │
│  - Save user data to localStorage        │
└──────┬───────────────────────────────────┘
       │
       │ 5. Redirect to home
       ▼
┌──────────────────────────────────────────┐
│  Home Page                               │
│  - AuthContext reads from localStorage   │
│  - User is authenticated ✅              │
└──────────────────────────────────────────┘
```

---

## 🧩 Component Relationships

```
┌─────────────────────────────────────────────────────┐
│                 BaseProvider                        │
│                                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │          GoogleOAuthProvider                  │ │
│  │  ┌─────────────────────────────────────────┐ │ │
│  │  │      QueryClientProvider                │ │ │
│  │  │  ┌───────────────────────────────────┐  │ │ │
│  │  │  │    SuiClientProvider              │  │ │ │
│  │  │  │  ┌─────────────────────────────┐  │  │ │ │
│  │  │  │  │    WalletProvider           │  │  │ │ │
│  │  │  │  │  ┌───────────────────────┐  │  │  │ │ │
│  │  │  │  │  │   AuthContext        │  │  │  │ │ │
│  │  │  │  │  │  ┌─────────────────┐ │  │  │  │ │ │
│  │  │  │  │  │  │ LoadingContext │ │  │  │  │ │ │
│  │  │  │  │  │  │  ┌───────────┐ │ │  │  │  │ │ │
│  │  │  │  │  │  │  │   App    │ │ │  │  │  │ │ │
│  │  │  │  │  │  │  └───────────┘ │ │  │  │  │ │ │
│  │  │  │  │  │  └─────────────────┘ │  │  │  │ │ │
│  │  │  │  │  └───────────────────────┘  │  │  │ │ │
│  │  │  │  └─────────────────────────────┘  │  │ │ │
│  │  │  └───────────────────────────────────┘  │ │ │
│  │  └─────────────────────────────────────────┘ │ │
│  └───────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

---

## 🎯 Key Components

### 1. **AuthContext** (`src/context/AuthContext.tsx`)
```typescript
interface AuthContextType {
    isAuthenticated: boolean;    // ✅ Logged in via any method
    address: string | null;      // 🏠 Sui address
    balance: string | null;      // 💰 SUI balance
    authMethod: 'wallet' | 'zklogin' | null;  // 🔐 Auth method
    user: DecodedJwt | null;     // 👤 Google user info (zkLogin only)
    loginWithZkLogin: () => void;  // 🚀 Start Google login
    disconnect: () => void;        // 🚪 Logout
}
```

### 2. **zkLogin Utilities** (`src/lib/zkLogin.ts`)
- `initiateZkLogin()` - Start OAuth flow
- `generateZkLoginState()` - Create ephemeral keypair & nonce
- `parseJwtFromUrl()` - Extract JWT from callback
- `saveZkLoginUser()` - Persist user session

### 3. **Login Page** (`src/app/login/page.tsx`)
```typescript
┌─────────────────────────────────────┐
│        Login Page                   │
├─────────────────────────────────────┤
│  ┌───────────────────────────────┐  │
│  │  🔐 Continue with Google      │  │ ← zkLogin
│  └───────────────────────────────┘  │
│                                     │
│  ┌───────────────────────────────┐  │
│  │  💼 Connect Wallet            │  │ ← Wallet Provider
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

### 4. **Callback Handler** (`src/app/auth/callback/page.tsx`)
- Receives OAuth redirect
- Processes JWT token
- Completes authentication
- Redirects to home

### 5. **Wallet Info Page** (`src/app/wallet/page.tsx`)
```typescript
┌─────────────────────────────────────┐
│      Wallet Info                    │
├─────────────────────────────────────┤
│  Auth Method: 🔐 zkLogin (Google)  │ ← Shows auth method
│                                     │
│  Address: 0x1234...5678             │
│  Balance: 10.5000 SUI               │
│                                     │
│  [Disconnect]                       │
└─────────────────────────────────────┘
```

---

## 🔑 Usage Examples

### Basic Usage
```typescript
import { useAuth } from '@/context/AuthContext';

function MyComponent() {
    const { 
        isAuthenticated, 
        address, 
        authMethod, 
        loginWithZkLogin 
    } = useAuth();

    if (!isAuthenticated) {
        return <button onClick={loginWithZkLogin}>Login</button>;
    }

    return (
        <div>
            <p>Logged in via: {authMethod}</p>
            <p>Address: {address}</p>
        </div>
    );
}
```

### Conditional Rendering
```typescript
const { authMethod, user } = useAuth();

{authMethod === 'zklogin' && (
    <p>Welcome, {user?.name}!</p>
)}

{authMethod === 'wallet' && (
    <p>Connected with Sui Wallet</p>
)}
```

---

## ⚙️ Configuration

### Environment Variables
```env
# Required for zkLogin
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com

# Optional
GOOGLE_CLIENT_SECRET=your-client-secret
NEXT_PUBLIC_SUI_RPC=https://fullnode.testnet.sui.io:443
```

### Google OAuth Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create OAuth 2.0 Client ID
3. Add authorized redirect URI:
   - `http://localhost:3000/auth/callback` (development)
   - `https://yourdomain.com/auth/callback` (production)

---

## 🔒 Storage Strategy

| Storage Type      | Used For                          | Example                      |
|-------------------|-----------------------------------|------------------------------|
| **sessionStorage** | Temporary OAuth flow data         | nonce, randomness, ephemeral key |
| **localStorage**   | Persistent user session           | user info, Sui address       |

```
Login Flow:
1. sessionStorage: Store nonce/randomness ➔ OAuth
2. localStorage: Save user after success ➔ Persist session
3. sessionStorage: Clear after login complete ✅
```

---

## 🚀 Authentication Priority

```
if (walletConnected) {
    authMethod = 'wallet'      // Priority 1
    address = wallet.address
} else if (zkLoginUser) {
    authMethod = 'zklogin'     // Priority 2
    address = zkLogin.address
} else {
    authMethod = null
    address = null
}
```

**Wallet Provider takes precedence** if both methods are available.

---

## 📊 State Management Flow

```
┌──────────────────┐
│   Page Load      │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────────┐
│  AuthContext Initialization      │
│  1. Check wallet connection      │
│  2. Load zkLogin from localStorage│
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│  Compute Auth State              │
│  - isAuthenticated               │
│  - address                       │
│  - authMethod                    │
│  - balance (fetch from chain)    │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│  Render App                      │
│  (all components have auth)      │
└──────────────────────────────────┘
```

---

## ✅ TODO: Production Enhancements

- [ ] Implement zkLogin proof generation (requires prover service)
- [ ] Add JWT token refresh logic
- [ ] Implement proper epoch management from Sui network
- [ ] Add error boundaries for OAuth failures
- [ ] Add analytics/logging for login flows
- [ ] Implement session timeout
- [ ] Add multi-provider support (GitHub, Facebook, etc.)

---

## 🐛 Troubleshooting

### Issue: "No zkLogin state found"
**Cause:** sessionStorage cleared before callback
**Fix:** Ensure browser doesn't clear storage on redirect

### Issue: Login redirects but not authenticated
**Cause:** localStorage not persisting
**Fix:** Check browser privacy settings / incognito mode

### Issue: Wallet and zkLogin both showing
**Cause:** Both methods authenticated simultaneously
**Expected:** Wallet takes precedence (by design)

---

## 📚 References

- [Sui zkLogin Documentation](https://docs.sui.io/concepts/cryptography/zklogin)
- [@mysten/zklogin Package](https://www.npmjs.com/package/@mysten/zklogin)
- [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)

---

**Built with ❤️ for Sui blockchain**
