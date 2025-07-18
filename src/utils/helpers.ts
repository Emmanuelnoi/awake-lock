import { NavigatorWithBattery, BatteryManager } from '../types';

export function isSSR(): boolean {
  return typeof window === 'undefined' || typeof document === 'undefined';
}

export function isWakeLockSupported(): boolean {
  if (isSSR()) return false;
  return 'wakeLock' in navigator && typeof (navigator as any).wakeLock?.request === 'function';
}

export function isPermissionsSupported(): boolean {
  if (isSSR()) return false;
  return 'permissions' in navigator && typeof navigator.permissions?.query === 'function';
}

export function isBatterySupported(): boolean {
  if (isSSR()) return false;
  const nav = navigator as NavigatorWithBattery;
  return typeof nav.getBattery === 'function';
}

export function isVisibilitySupported(): boolean {
  if (isSSR()) return false;
  return 'visibilityState' in document && typeof document.addEventListener === 'function';
}

export async function getBattery(): Promise<BatteryManager | null> {
  if (!isBatterySupported()) return null;

  try {
    const nav = navigator as NavigatorWithBattery;
    return await nav.getBattery!();
  } catch {
    return null;
  }
}

export async function checkPermission(name: PermissionName): Promise<PermissionState | null> {
  if (!isPermissionsSupported()) return null;

  try {
    const result = await navigator.permissions.query({ name });
    return result.state;
  } catch {
    return null;
  }
}

export function createTimeout(ms: number, signal?: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Operation timed out after ${ms}ms`));
    }, ms);

    signal?.addEventListener('abort', () => {
      clearTimeout(timeoutId);
      reject(new Error('Operation was aborted'));
    });
  });
}

export function withTimeout<T>(promise: Promise<T>, ms: number, signal?: AbortSignal): Promise<T> {
  return Promise.race([promise, createTimeout(ms, signal)]);
}

export function debounce<T extends unknown[]>(
  fn: (...args: T) => void,
  delay: number
): (...args: T) => void {
  let timeoutId: ReturnType<typeof setTimeout>;

  return (...args: T): void => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

export function throttle<T extends unknown[]>(
  fn: (...args: T) => void,
  limit: number
): (...args: T) => void {
  let inThrottle: boolean;

  return (...args: T): void => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

export function isLowPowerMode(): boolean {
  if (isSSR()) return false;

  // Check for potential low power mode indicators
  try {
    // Safari low power mode detection
    if ('connection' in navigator) {
      const connection = (navigator as { connection?: { saveData?: boolean } }).connection;
      if (connection?.saveData) return true;
    }

    // Check device memory (Chrome)
    if ('deviceMemory' in navigator) {
      const memory = (navigator as { deviceMemory?: number }).deviceMemory;
      if (memory && memory <= 2) return true;
    }

    // Check hardware concurrency
    if (navigator.hardwareConcurrency <= 2) return true;

    return false;
  } catch {
    return false;
  }
}

export function generateUniqueId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function isDocumentHidden(): boolean {
  if (isSSR()) return false;
  return document.visibilityState === 'hidden';
}

export function getPerformanceNow(): number {
  if (isSSR()) return Date.now();
  return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
}

export function getMemoryUsage(): number {
  if (isSSR()) return 0;

  try {
    // Chrome memory info
    if ('memory' in performance) {
      const memory = (performance as { memory?: { usedJSHeapSize?: number } }).memory;
      return memory?.usedJSHeapSize ?? 0;
    }
    return 0;
  } catch {
    return 0;
  }
}

export function isMobile(): boolean {
  if (isSSR()) return false;

  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

export function isIOS(): boolean {
  if (isSSR()) return false;

  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export function isSafari(): boolean {
  if (isSSR()) return false;

  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}
