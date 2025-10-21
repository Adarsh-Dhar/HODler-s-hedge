import { useState, useEffect, useCallback } from 'react';

interface BTCPriceData {
  price: number;
  market_cap: number;
  volume_24h: number;
  change_24h: number;
  last_updated: string;
  currency: string;
  symbol: string;
  name: string;
}

interface BTCPriceResponse {
  success: boolean;
  data: BTCPriceData;
  error?: string;
}

interface UseBTCPriceOptions {
  refreshInterval?: number; // in milliseconds
  autoRefresh?: boolean;
}

export function useBTCPrice(options: UseBTCPriceOptions = {}) {
  const { refreshInterval = 30000, autoRefresh = true } = options;
  
  const [data, setData] = useState<BTCPriceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchPrice = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch('/api/price');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result: BTCPriceResponse = await response.json();
      
      if (result.success) {
        setData(result.data);
        setLastUpdated(new Date());
      } else {
        throw new Error(result.error || 'Failed to fetch price data');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Error fetching BTC price:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHistoricalPrice = useCallback(async (date: string) => {
    try {
      setError(null);
      setLoading(true);
      
      const response = await fetch(`/api/price?type=historical&date=${date}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result: BTCPriceResponse = await response.json();
      
      if (result.success) {
        setData(result.data);
        setLastUpdated(new Date());
      } else {
        throw new Error(result.error || 'Failed to fetch historical price data');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Error fetching historical BTC price:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchPrice();
  }, [fetchPrice]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchPrice();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [fetchPrice, refreshInterval, autoRefresh]);

  return {
    data,
    loading,
    error,
    lastUpdated,
    refetch: fetchPrice,
    fetchHistorical: fetchHistoricalPrice,
  };
}
