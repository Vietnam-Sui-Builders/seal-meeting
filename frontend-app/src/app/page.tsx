'use client'

import { useWallet } from '@/context/WalletContext';
import Link from 'next/link';

export default function HomePage() {
  const { isConnected } = useWallet();
  let connect = () => {

  }
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center h-[50vh] text-center">
        <h1 className="text-5xl font-bold mb-4">Secure Meetings, Owned by You—Powered by Sui</h1>
        <p className="text-xl mb-6 max-w-2xl">
          Host private video calls, seal invites with your wallet, and mint NFT badges—all on the fastest blockchain.
        </p>
        <div>
          <Link href="/learn-more" className="px-6 py-3 border border-blue-500 text-blue-500 rounded-lg">
            Learn More
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 p-8">
        <div className="p-6 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <h3 className="text-xl font-semibold">Sealed Invites</h3>
          <p>Control access with Sui’s Seal—only approved wallets join.</p>
        </div>
        <div className="p-6 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <h3 className="text-xl font-semibold">P2P Calls</h3>
          <p>Fast, encrypted video via Sui Stack Messaging.</p>
        </div>
        <div className="p-6 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <h3 className="text-xl font-semibold">NFT Badges</h3>
          <p>Mint POAPs for attendees, verifiable on Sui.</p>
        </div>
        <div className="p-6 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <h3 className="text-xl font-semibold">Calendar Sync</h3>
          <p>Seamless invites to Google/Outlook with one click.</p>
        </div>
      </section>

      {/* CTA Band */}
      <section className="bg-blue-500 text-white text-center py-8">
        <h2 className="text-2xl mb-4">Ready to Meet Securely?</h2>
        <Link href="/demo" className="px-6 py-3 border border-white text-white rounded-lg">
          Join a Demo
        </Link>
      </section>

      {/* Footer */}
      <footer className="p-4 text-center">
        <p>Built on <a href="https://sui.io" className="text-blue-500">Sui</a> | <a href="/docs">Docs</a> | <a href="/discord">Discord</a> | <a href="/x">X</a></p>
        <p>MIT License © 2025 SuiMeet</p>
      </footer>
    </div>
  );
}