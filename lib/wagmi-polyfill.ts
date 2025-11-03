// Polyfill for indexedDB during SSR/build to prevent errors
if (typeof window === 'undefined') {
  // Mock indexedDB during server-side rendering with a no-op implementation
  (global as any).indexedDB = {
    open: () => ({
      onerror: null,
      onsuccess: null,
      onupgradeneeded: null,
      result: null,
      error: null,
    }),
  };
}

