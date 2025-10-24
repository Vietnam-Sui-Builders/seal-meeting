// ============================================
// FILE: app/page.tsx
// ============================================
import React from 'react';
import { Upload, Shield, Zap, Lock } from 'lucide-react';
import FeatureCard from '@/components/general/FeatureCard';
import Step from '@/components/general/Step';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50">
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            Decentralized File Storage
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-cyan-500">
              Powered by Sui
            </span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Upload, store, and manage your files securely on the Sui blockchain.
            Experience true ownership with decentralized storage.
          </p>
          <div className="flex gap-4 justify-center">
            <button className="px-8 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl font-medium hover:shadow-lg transition-all duration-200">
              Get Started
            </button>
            <button className="px-8 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-xl font-medium hover:border-gray-400 transition-all duration-200">
              Learn More
            </button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Why Choose Sui File Upload?
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <FeatureCard
              icon={<Shield className="w-8 h-8 text-blue-500" />}
              title="Secure Storage"
              description="Your files are encrypted and stored securely on the blockchain"
            />
            <FeatureCard
              icon={<Lock className="w-8 h-8 text-cyan-500" />}
              title="True Ownership"
              description="You maintain complete control and ownership of your data"
            />
            <FeatureCard
              icon={<Zap className="w-8 h-8 text-blue-500" />}
              title="Fast & Efficient"
              description="Leveraging Sui's high-performance blockchain technology"
            />
            <FeatureCard
              icon={<Upload className="w-8 h-8 text-cyan-500" />}
              title="Easy Upload"
              description="Simple interface for uploading and managing your files"
            />
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="container mx-auto px-4 py-20 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            How It Works
          </h2>
          <div className="space-y-8">
            <Step
              number="1"
              title="Connect Your Wallet"
              description="Sign in using zkLogin with Google or connect your Sui wallet"
            />
            <Step
              number="2"
              title="Upload Your Files"
              description="Select and upload files securely to the Sui blockchain"
            />
            <Step
              number="3"
              title="Manage & Share"
              description="Access, manage, and share your files anytime, anywhere"
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-3xl mx-auto text-center bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl p-12 text-white">
          <h2 className="text-3xl font-bold mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-lg mb-8 opacity-90">
            Connect your wallet and start uploading files securely today
          </p>
          <button className="px-8 py-3 bg-white text-blue-600 rounded-xl font-medium hover:shadow-lg transition-all duration-200">
            Connect Wallet
          </button>
        </div>
      </section>
    </div>
  );
}