export type WakeLockType = 'screen' | 'system';

export interface WakeLockOptions {
  strategies?: FallbackStrategy[];
  debug?: boolean;
  batteryOptimization?: boolean;
  performanceMonitoring?: boolean;
  passive?: boolean;
}

export interface RequestOptions {
  passive?: boolean;
  timeout?: number;
  retryAttempts?: number;
  signal?: AbortSignal;
}

export interface WakeLockSentinel {
  readonly type: WakeLockType;
  readonly released: boolean;
  release(): Promise<void>;
  addEventListener(type: 'release', listener: () => void): void;
  removeEventListener(type: 'release', listener: () => void): void;
}

export interface WakeLockStatus {
  isActive: boolean;
  type: WakeLockType | null;
  strategy: string | null;
  startTime: number | null;
  batteryLevel: number | null;
  performanceMetrics: PerformanceMetrics | null;
}

export interface PerformanceMetrics {
  cpuUsage: number;
  memoryUsage: number;
  batteryDrain: number;
  timestamp: number;
}

export interface BatteryManager {
  readonly charging: boolean;
  readonly chargingTime: number;
  readonly dischargingTime: number;
  readonly level: number;
  onchargingchange: ((this: BatteryManager, ev: Event) => void) | null;
  onchargingtimechange: ((this: BatteryManager, ev: Event) => void) | null;
  ondischargingtimechange: ((this: BatteryManager, ev: Event) => void) | null;
  onlevelchange: ((this: BatteryManager, ev: Event) => void) | null;
}

export interface NavigatorWithBattery extends Navigator {
  getBattery?(): Promise<BatteryManager>;
}

export interface FallbackStrategy {
  readonly name: string;
  readonly priority: number;
  isSupported(): boolean;
  request(type: WakeLockType, options?: RequestOptions): Promise<WakeLockSentinel>;
  release?(): Promise<void>;
}

export interface WakeLockEvents extends Record<string, unknown> {
  enabled: { type: WakeLockType; strategy: string };
  disabled: { type: WakeLockType; reason: string };
  error: { error: WakeLockError; strategy?: string };
  performance: PerformanceMetrics;
  fallback: { from: string; to: string; reason: string };
  'battery-change': { level: number; charging: boolean };
  'visibility-change': { hidden: boolean; action: 'acquired' | 'released' | 'none' };
}

export interface EventListener<T = unknown> {
  (event: T): void;
}

export class WakeLockError extends Error {
  public readonly code: WakeLockErrorCode;
  public readonly strategy?: string | undefined;
  public readonly originalError?: Error | undefined;

  constructor(
    message: string,
    code: WakeLockErrorCode,
    strategy?: string | undefined,
    originalError?: Error | undefined
  ) {
    super(message);
    this.name = 'WakeLockError';
    this.code = code;
    this.strategy = strategy;
    this.originalError = originalError;
  }
}

export enum WakeLockErrorCode {
  NOT_SUPPORTED = 'NOT_SUPPORTED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  INVALID_STATE = 'INVALID_STATE',
  TIMEOUT = 'TIMEOUT',
  BATTERY_LOW = 'BATTERY_LOW',
  STRATEGY_FAILED = 'STRATEGY_FAILED',
  UNKNOWN = 'UNKNOWN',
}

export interface VisibilityChangeOptions {
  autoReacquire?: boolean;
  releaseOnHidden?: boolean;
}

export interface BatteryOptimizationOptions {
  lowBatteryThreshold?: number;
  autoReleaseOnLowBattery?: boolean;
  reducedPerformanceMode?: boolean;
}

export interface DebugOptions {
  logLevel?: 'error' | 'warn' | 'info' | 'debug';
  logStrategy?: boolean;
  logPerformance?: boolean;
  logBattery?: boolean;
}

export interface InternalWakeLockSentinel extends WakeLockSentinel {
  _strategy: FallbackStrategy;
  _releaseListeners: Set<() => void>;
  _released: boolean;
}

export type EventMap = {
  [K in keyof WakeLockEvents]: WakeLockEvents[K];
} & Record<string, unknown>;

export interface TypedEventTarget<T extends Record<string, unknown>> {
  addEventListener<K extends keyof T>(
    type: K,
    listener: EventListener<T[K]>,
    options?: boolean | AddEventListenerOptions
  ): void;

  removeEventListener<K extends keyof T>(
    type: K,
    listener: EventListener<T[K]>,
    options?: boolean | EventListenerOptions
  ): void;

  dispatchEvent<K extends keyof T>(type: K, event: T[K]): boolean;
}

// Custom wake lock types to avoid conflicts with DOM types
export interface CustomWakeLockSentinel {
  readonly type: WakeLockType;
  readonly released: boolean;
  release(): Promise<void>;
  addEventListener(type: 'release', listener: () => void): void;
  removeEventListener(type: 'release', listener: () => void): void;
}
