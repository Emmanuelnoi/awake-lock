// Core library exports without framework dependencies
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

// Default export
export { WakeLock as default } from './WakeLock';
