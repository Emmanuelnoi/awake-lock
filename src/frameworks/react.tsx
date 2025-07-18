// Type stubs for when React is not available
declare global {
  namespace JSX {
    interface Element {}
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  createContext,
  useContext,
  type ReactNode,
  type ComponentType,
} from 'react';
import { WakeLock } from '../WakeLock';
import {
  WakeLockOptions,
  WakeLockType,
  RequestOptions,
  WakeLockStatus,
  WakeLockSentinel,
  WakeLockEvents,
} from '../types';

export interface UseWakeLockReturn {
  isSupported: boolean;
  isActive: boolean;
  status: WakeLockStatus;
  request: (type?: WakeLockType, options?: RequestOptions) => Promise<WakeLockSentinel>;
  release: () => Promise<void>;
  error: Error | null;
  isLoading: boolean;
}

export interface UseWakeLockOptions extends WakeLockOptions {
  autoRequest?: boolean;
  type?: WakeLockType;
  requestOptions?: RequestOptions;
  onEnabled?: (event: WakeLockEvents['enabled']) => void;
  onDisabled?: (event: WakeLockEvents['disabled']) => void;
  onError?: (event: WakeLockEvents['error']) => void;
  onBatteryChange?: (event: WakeLockEvents['battery-change']) => void;
  onPerformance?: (event: WakeLockEvents['performance']) => void;
  onFallback?: (event: WakeLockEvents['fallback']) => void;
  onVisibilityChange?: (event: WakeLockEvents['visibility-change']) => void;
}

export function useWakeLock(options: UseWakeLockOptions = {}): UseWakeLockReturn {
  const {
    autoRequest = false,
    type = 'screen',
    requestOptions = {},
    onEnabled,
    onDisabled,
    onError,
    onBatteryChange,
    onPerformance,
    onFallback,
    onVisibilityChange,
    ...wakeLockOptions
  } = options;

  const wakeLockRef = useRef<WakeLock | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [status, setStatus] = useState<WakeLockStatus>({
    isActive: false,
    type: null,
    strategy: null,
    startTime: null,
    batteryLevel: null,
    performanceMetrics: null,
  });
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Initialize WakeLock instance
  useEffect(() => {
    wakeLockRef.current = new WakeLock(wakeLockOptions);
    const wakeLock = wakeLockRef.current;

    // Set up event listeners
    const setupEventListeners = (): void => {
      wakeLock.on('enabled', (event: any) => {
        setIsActive(true);
        setStatus(wakeLock.getStatus());
        setError(null);
        onEnabled?.(event);
      });

      wakeLock.on('disabled', (event: any) => {
        setIsActive(false);
        setStatus(wakeLock.getStatus());
        onDisabled?.(event);
      });

      wakeLock.on('error', (event: any) => {
        setError(event.error);
        setIsLoading(false);
        onError?.(event);
      });

      wakeLock.on('battery-change', (event: any) => {
        setStatus(wakeLock.getStatus());
        onBatteryChange?.(event);
      });

      wakeLock.on('performance', (event: any) => {
        setStatus(wakeLock.getStatus());
        onPerformance?.(event);
      });

      wakeLock.on('fallback', (event: any) => {
        onFallback?.(event);
      });

      wakeLock.on('visibility-change', (event: any) => {
        onVisibilityChange?.(event);
      });
    };

    setupEventListeners();

    // Auto-request wake lock if enabled
    if (autoRequest) {
      setIsLoading(true);
      wakeLock
        .request(type, requestOptions)
        .then(() => {
          setIsLoading(false);
        })
        .catch((err: any) => {
          setError(err);
          setIsLoading(false);
        });
    }

    // Cleanup on unmount
    return () => {
      wakeLock.destroy();
    };
  }, []);

  // Update event listeners when callbacks change
  useEffect(() => {
    if (!wakeLockRef.current) return;

    const wakeLock = wakeLockRef.current;

    // Remove all existing listeners
    wakeLock.removeAllListeners();

    // Re-add listeners with current callbacks
    wakeLock.on('enabled', (event: any) => {
      setIsActive(true);
      setStatus(wakeLock.getStatus());
      setError(null);
      onEnabled?.(event);
    });

    wakeLock.on('disabled', (event: any) => {
      setIsActive(false);
      setStatus(wakeLock.getStatus());
      onDisabled?.(event);
    });

    wakeLock.on('error', (event: any) => {
      setError(event.error);
      setIsLoading(false);
      onError?.(event);
    });

    wakeLock.on('battery-change', (event: any) => {
      setStatus(wakeLock.getStatus());
      onBatteryChange?.(event);
    });

    wakeLock.on('performance', (event: any) => {
      setStatus(wakeLock.getStatus());
      onPerformance?.(event);
    });

    wakeLock.on('fallback', onFallback);
    wakeLock.on('visibility-change', onVisibilityChange);
  }, [
    onEnabled,
    onDisabled,
    onError,
    onBatteryChange,
    onPerformance,
    onFallback,
    onVisibilityChange,
  ]);

  const request = useCallback(
    async (
      requestType: WakeLockType = type,
      options: RequestOptions = requestOptions
    ): Promise<WakeLockSentinel> => {
      if (!wakeLockRef.current) {
        throw new Error('WakeLock not initialized');
      }

      setIsLoading(true);
      setError(null);

      try {
        const sentinel = await wakeLockRef.current.request(requestType, options);
        setIsLoading(false);
        return sentinel;
      } catch (err) {
        setIsLoading(false);
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        throw error;
      }
    },
    [type, requestOptions]
  );

  const release = useCallback(async (): Promise<void> => {
    if (!wakeLockRef.current) return;

    try {
      await wakeLockRef.current.release();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to release wake lock');
      setError(error);
      throw error;
    }
  }, []);

  const isSupported = wakeLockRef.current?.isSupported() ?? false;

  return {
    isSupported,
    isActive,
    status,
    request,
    release,
    error,
    isLoading,
  };
}

// Higher-order component for class components
export interface WithWakeLockProps {
  wakeLock: UseWakeLockReturn;
}

export function withWakeLock<P extends object>(
  Component: ComponentType<P & WithWakeLockProps>,
  options: UseWakeLockOptions = {}
): ComponentType<P> {
  return function WakeLockWrappedComponent(props: P) {
    const wakeLock = useWakeLock(options);

    return <Component {...props} wakeLock={wakeLock} />;
  };
}

// Context for providing wake lock throughout the app
export const WakeLockContext = createContext<UseWakeLockReturn | null>(null);

export interface WakeLockProviderProps {
  children: ReactNode;
  options?: UseWakeLockOptions;
}

export function WakeLockProvider({ children, options = {} }: WakeLockProviderProps): JSX.Element {
  const wakeLock = useWakeLock(options);

  return <WakeLockContext.Provider value={wakeLock}>{children}</WakeLockContext.Provider>;
}

export function useWakeLockContext(): UseWakeLockReturn {
  const context = useContext(WakeLockContext);
  if (!context) {
    throw new Error('useWakeLockContext must be used within a WakeLockProvider');
  }
  return context;
}

// Re-export React types for convenience
export type { ReactNode, ComponentType, JSX } from 'react';
