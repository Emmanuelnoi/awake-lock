// Core library exports without framework dependencies
export { WakeLock } from './WakeLock';
export { PermissionManager } from './PermissionManager';
export { PerformanceMonitor } from './PerformanceMonitor';

// Essential strategies (VideoElementStrategy available via separate import)
export { ScreenWakeLockStrategy } from './strategies/ScreenWakeLockStrategy';
export { AudioContextStrategy } from './strategies/AudioContextStrategy';
export { TimerStrategy } from './strategies/TimerStrategy';

// Essential utilities only
export { EventEmitter } from './utils/EventEmitter';
export {
  isSSR,
  isWakeLockSupported,
  generateUniqueId,
} from './utils/helpers';

// Essential types only
export type {
  WakeLockType,
  WakeLockSentinel,
  WakeLockOptions,
  RequestOptions,
  WakeLockEvents,
  WakeLockStatus,
  FallbackStrategy,
  WakeLockError,
  WakeLockErrorCode,
} from './types';

// Note: No default export for UMD compatibility
