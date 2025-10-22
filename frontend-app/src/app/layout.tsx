// ============================================
// FILE: app/layout.tsx
// ============================================
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "@mysten/dapp-kit/dist/index.css";
import Navbar from "@/components/general/Navbar";
import { Providers } from "@/provider/BaseProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Sui File Upload - Decentralized Storage",
  description: "Upload and manage files on Sui blockchain",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <div>
            <Navbar />
            <main className="pt-16">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html >
  );
}




