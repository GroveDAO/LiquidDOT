import React from "react";
import { Inter } from "next/font/google";
import type { Metadata } from "next";
import Providers from "./providers";
import Link from "next/link";
import ConnectWallet from "../components/ConnectWallet";
import "@rainbow-me/rainbowkit/styles.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "LiquidDOT — Native Liquid Staking on Polkadot",
  description:
    "The first liquid staking protocol on Polkadot Hub. Deposit DOT, receive stDOT, and earn auto-compounding NPoS staking rewards.",
  openGraph: {
    images: ["/og-image.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-gray-950 text-white min-h-screen`}>
        <Providers>
          {/* Header */}
          <header className="border-b border-gray-800 px-6 py-4">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-8">
                <Link href="/" className="flex items-center gap-2">
                  <span className="text-2xl font-extrabold bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent">
                    LiquidDOT
                  </span>
                </Link>
                <nav className="hidden md:flex items-center gap-6">
                  <Link href="/stake" className="text-gray-400 hover:text-white transition-colors text-sm font-medium">
                    Stake
                  </Link>
                  <Link href="/unstake" className="text-gray-400 hover:text-white transition-colors text-sm font-medium">
                    Unstake
                  </Link>
                  <Link href="/governance" className="text-gray-400 hover:text-white transition-colors text-sm font-medium">
                    Governance
                  </Link>
                </nav>
              </div>
              <ConnectWallet />
            </div>
          </header>

          {/* Main */}
          <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>

          {/* Footer */}
          <footer className="border-t border-gray-800 px-6 py-6 mt-16">
            <div className="max-w-7xl mx-auto flex items-center justify-between text-sm text-gray-500">
              <div className="flex items-center gap-4">
                <a
                  href="https://github.com/GroveDAO/LiquidDOT"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  GitHub
                </a>
              </div>
              <span className="flex items-center gap-2">
                🏆 Built for{" "}
                <a
                  href="https://polkadot.network/hackathon"
                  className="text-pink-400 hover:text-pink-300 transition-colors"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Polkadot Solidity Hackathon 2026
                </a>
              </span>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
