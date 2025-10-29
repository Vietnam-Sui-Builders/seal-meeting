'use client'

import { useCurrentAccount } from '@mysten/dapp-kit';
import Link from 'next/link';
import { PlusIcon, LockClosedIcon, LightningBoltIcon, PersonIcon, CalendarIcon, UpdateIcon } from '@radix-ui/react-icons';
import { useAuth } from '@/context/AuthContext';

export default function HomePage() {
  const currentAccount = useCurrentAccount();
  const { isConnecting } = useAuth();
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50">
      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4 pt-20">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 text-gray-900">
            Secure Meetings, Owned by You
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-cyan-500">
              Powered by Sui
            </span>
          </h1>
          <p className="text-xl md:text-2xl mb-8 max-w-3xl mx-auto text-gray-600">
            Host private video calls with blockchain-secured access control. Only approved wallets can join.
          </p>
          <div className="flex gap-4 justify-center">
            {isConnecting ? (
              <div className="flex items-center gap-3 px-8 py-4 bg-gray-200 rounded-xl">
                <UpdateIcon className="w-5 h-5 text-gray-600 animate-spin" />
                <span className="text-lg font-semibold text-gray-600">Connecting...</span>
              </div>
            ) : currentAccount ? (
              <Link 
                href="/room" 
                className="flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl font-semibold text-lg hover:shadow-xl transition-all duration-200"
              >
                <PlusIcon className="w-5 h-5" />
                Create Your First Room
              </Link>
            ) : (
              <Link 
                href="/login" 
                className="px-8 py-4 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl font-semibold text-lg hover:shadow-xl transition-all duration-200"
              >
                Get Started
              </Link>
            )}
          </div>
          {!isConnecting && currentAccount && (
            <p className="mt-4 text-sm text-green-600 font-medium">
              ✓ Wallet Connected - Ready to create rooms!
            </p>
          )}
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">Why Choose SuiMeet?</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-6 bg-white rounded-2xl shadow-lg hover:shadow-xl transition-shadow">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
              <LockClosedIcon className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Sealed Invites</h3>
            <p className="text-gray-600">Control access with blockchain whitelist—only approved wallets join.</p>
          </div>
          <div className="p-6 bg-white rounded-2xl shadow-lg hover:shadow-xl transition-shadow">
            <div className="w-12 h-12 bg-cyan-100 rounded-xl flex items-center justify-center mb-4">
              <LightningBoltIcon className="w-6 h-6 text-cyan-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">P2P Calls</h3>
            <p className="text-gray-600">Fast, encrypted video via Sui Stack Messaging SDK.</p>
          </div>
          <div className="p-6 bg-white rounded-2xl shadow-lg hover:shadow-xl transition-shadow">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-4">
              <PersonIcon className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">NFT Badges</h3>
            <p className="text-gray-600">Mint POAP attendance badges, verifiable on Sui blockchain.</p>
          </div>
          <div className="p-6 bg-white rounded-2xl shadow-lg hover:shadow-xl transition-shadow">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4">
              <CalendarIcon className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Calendar Sync</h3>
            <p className="text-gray-600">Seamless invites to Google/Outlook with one click.</p>
          </div>
        </div>
      </section>

      {/* CTA Band */}
      <section className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Meet Securely?</h2>
          <p className="text-lg mb-8 opacity-90">Connect your wallet and create your first blockchain-secured meeting room</p>
          {isConnecting ? (
            <div className="inline-flex items-center gap-3 px-8 py-4 bg-white text-gray-600 rounded-xl font-semibold text-lg">
              <UpdateIcon className="w-5 h-5 animate-spin" />
              Connecting...
            </div>
          ) : currentAccount ? (
            <Link 
              href="/room" 
              className="inline-flex items-center gap-2 px-8 py-4 bg-white text-blue-600 rounded-xl font-semibold text-lg hover:shadow-xl transition-all duration-200"
            >
              <PlusIcon className="w-5 h-5" />
              Create Room Now
            </Link>
          ) : (
            <Link 
              href="/login" 
              className="inline-block px-8 py-4 bg-white text-blue-600 rounded-xl font-semibold text-lg hover:shadow-xl transition-all duration-200"
            >
              Connect Wallet
            </Link>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-8">
        <div className="container mx-auto px-4 text-center">
          <p className="text-gray-600 mb-2">
            Built on <a href="https://sui.io" className="text-blue-500 hover:text-blue-600 font-medium">Sui Blockchain</a>
          </p>
          <p className="text-gray-500 text-sm">MIT License © 2025 SuiMeet - Decentralized Meetings</p>
        </div>
      </footer>
    </div>
  );
}