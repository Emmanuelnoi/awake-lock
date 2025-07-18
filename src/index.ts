// Main exports
export { WakeLock } from './WakeLock';
export { PermissionManager } from './PermissionManager';
export { PerformanceMonitor } from './PerformanceMonitor';

// Strategies
export { ScreenWakeLockStrategy } from './strategies/ScreenWakeLockStrategy';
export { VideoElementStrategy } from './strategies/VideoElementStrategy';
export { AudioContextStrategy } from './strategies/AudioContextStrategy';
export { TimerStrategy } from './strategies/TimerStrategy';

// Utilities
export { EventEmitter } from './utils/EventEmitter';
export * from './utils/helpers';

// Types
export * from './types';

// Framework integrations (conditionally exported)
export {
  useWakeLock as useWakeLockReact,
  UseWakeLockOptions as UseWakeLockOptionsReact,
  UseWakeLockReturn as UseWakeLockReturnReact,
  withWakeLock,
  WakeLockProvider,
  WakeLockContext,
  useWakeLockContext,
} from './frameworks/react';

export {
  useWakeLock as useWakeLockVue,
  UseWakeLockOptions as UseWakeLockOptionsVue,
  UseWakeLockReturn as UseWakeLockReturnVue,
  useWakeLockStore,
  WakeLockMixin,
} from './frameworks/vue';

export {
  WakeLockService,
  WakeLockDirective,
  WakeLockModule,
  WakeLockGuard,
  WakeLockResolver,
  WakeLockStatusPipe,
  provideWakeLock,
  WAKE_LOCK_CONFIG,
} from './frameworks/angular';

// Default export
export default WakeLock;
