"use client"

// Import polyfill first to prevent indexedDB errors during build
import "@/lib/wagmi-polyfill";

import React from "react";
import { RainbowKitProvider, getDefaultConfig, darkTheme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { sepolia } from "wagmi/chains";
import { createStorage } from "@wagmi/core";

export const mezoChain = {
  id: 31611,
  name: "Mezo Testnet",
  nativeCurrency: {
    decimals: 18,
    name: "Bitcoin",
    symbol: "BTC",
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.test.mezo.org"],
      webSocket: ["wss://rpc-ws.test.mezo.org"],
    },
  },
  blockExplorers: {
    default: {
      name: "Mezo Testnet Explorer",
      url: "https://explorer.test.mezo.org",
    },
  },
  contracts: {
    multicall3: {
      address: "0xcA11bde05977b3631167028862bE2a173976CA11",
      blockCreated: 3669328,
    },
  },
  testnet: true,
} as const;

const projectId = "d328cb87d39eef9ebaff55956a57c45e";

// Create SSR-safe storage that uses localStorage on client, no-op on server
// Use a no-op storage during SSR to prevent indexedDB errors during build
// We need to create storage lazily to avoid accessing window during build
let storage: ReturnType<typeof createStorage> | null = null;

function getStorage() {
  if (typeof window === "undefined") {
    // Server-side: return a no-op storage that won't trigger indexedDB
    if (!storage) {
      storage = createStorage({
        storage: {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        },
      });
    }
    return storage;
  }
  // Client-side: use localStorage (but only create once)
  if (!storage) {
    storage = createStorage({
      storage: window.localStorage,
    });
  }
  return storage;
}

// Create config lazily to avoid accessing storage during module initialization
function getConfig() {
  return getDefaultConfig({
    appName: "HODLer's Hedge",
    projectId,
    chains: [ mezoChain],
    ssr: false, // Disable SSR to prevent indexedDB access during build
    storage: getStorage(),
  });
}

// Export a getter function instead of the config itself to avoid initialization during build
export function getWagmiConfig() {
  return getConfig();
}

// Create QueryClient inside the component to avoid SSR issues
let queryClient: QueryClient | undefined;

function getQueryClient() {
  if (typeof window === "undefined") {
    // Server: always make a new query client
    return new QueryClient({
      defaultOptions: {
        queries: {
          // With SSR, we usually want to set some default staleTime
          // above 0 to avoid refetching immediately on the client
          staleTime: 60 * 1000,
        },
      },
    });
  }
  // Browser: use singleton pattern to keep the same query client
  if (!queryClient) {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 60 * 1000,
        },
      },
    });
  }
  return queryClient;
}

export function Providers({ children }: { children: React.ReactNode }) {
  // Always render providers - they handle SSR internally
  // The storage no-op prevents indexedDB access during SSR
  const client = getQueryClient();
  const wagmiConfig = getConfig();

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={client}>
        <RainbowKitProvider 
          theme={darkTheme()}
          modalSize="compact"
          showRecentTransactions={true}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}