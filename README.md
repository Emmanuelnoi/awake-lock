# AwakeLock 🔋

A comprehensive, framework-agnostic TypeScript library for preventing device sleep with intelligent fallback strategies, battery optimization, and performance monitoring.

[![npm version](https://img.shields.io/npm/v/awake-lock.svg)](https://www.npmjs.com/package/awake-lock)
[![Bundle size](https://img.shields.io/bundlephobia/minzip/awake-lock.svg)](https://bundlephobia.com/result?p=awake-lock)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![Browser support](https://img.shields.io/badge/Browser-95%2B%25-green.svg)](#browser-support)
[![Tests](https://img.shields.io/badge/Tests-25%2F25%20Passing-green.svg)](#testing)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Features

- 🔋 **Modern Screen Wake Lock API** with intelligent fallback strategies
- 🌐 **Universal Support** - Works with React, Vue, Angular, and Vanilla JS
- 🛡️ **Passive Mode** - Fail silently when user permission prompts would be disruptive
- 🔧 **Pluggable Strategy System** - Custom fallback implementations
- 📊 **Battery Optimization** - Automatic release on low battery
- 📈 **Performance Monitoring** - Track resource usage and battery impact
- 🎯 **TypeScript First** - Complete type safety with strict mode
- 📱 **Mobile Optimized** - Special handling for iOS Safari and mobile browsers
- 🎨 **Framework Integrations** - Hooks, composables, and services included
- 🏗️ **SSR Safe** - Server-side rendering compatible

## Installation

```bash
# Using npm
npm install awake-lock

# Using pnpm (recommended)
pnpm add awake-lock

# Using yarn
yarn add awake-lock
```

## Package Structure

## Quick Start

### Vanilla JavaScript/TypeScript

```typescript
import { WakeLock } from 'awake-lock';

const wakeLock = new WakeLock();

// Request wake lock
const sentinel = await wakeLock.request('screen');

// Release wake lock
await wakeLock.release();
```

### React Hook

```tsx
import { useWakeLock } from 'awake-lock';

function VideoPlayer() {
  const { isActive, request, release, isSupported } = useWakeLock({
    onEnabled: () => console.log('Wake lock enabled'),
    onDisabled: () => console.log('Wake lock disabled'),
  });

  return (
    <div>
      {isSupported ? (
        <button onClick={() => (isActive ? release() : request())}>
          {isActive ? 'Release' : 'Keep Screen On'}
        </button>
      ) : (
        <p>Wake lock not supported</p>
      )}
    </div>
  );
}
```

### Vue Composable

```vue
<template>
  <div>
    <button @click="toggle" :disabled="!isSupported">
      {{ isActive ? 'Release' : 'Keep Screen On' }}
    </button>
  </div>
</template>

<script setup>
import { useWakeLock } from 'awake-lock';

const { isActive, request, release, isSupported } = useWakeLock({
  onEnabled: () => console.log('Wake lock enabled'),
  onDisabled: () => console.log('Wake lock disabled'),
});

const toggle = () => {
  isActive.value ? release() : request();
};
</script>
```

### Angular Service

```typescript
import { Component, OnInit } from '@angular/core';
import { WakeLockService } from 'awake-lock';

@Component({
  selector: 'app-video-player',
  template: `
    <button (click)="toggle()" [disabled]="!isSupported">
      {{ (isActive$ | async) ? 'Release' : 'Keep Screen On' }}
    </button>
  `,
})
export class VideoPlayerComponent implements OnInit {
  isActive$ = this.wakeLockService.isActive$;
  isSupported = this.wakeLockService.isSupported();

  constructor(private wakeLockService: WakeLockService) {}

  async toggle() {
    const isActive = await this.isActive$.pipe(take(1)).toPromise();
    if (isActive) {
      await this.wakeLockService.release();
    } else {
      await this.wakeLockService.request();
    }
  }
}
```

## Core API

### WakeLock Class

```typescript
class WakeLock extends EventEmitter {
  constructor(options?: WakeLockOptions);
  request(type: 'screen' | 'system', options?: RequestOptions): Promise<WakeLockSentinel>;
  release(): Promise<void>;
  isSupported(): boolean;
  getStatus(): WakeLockStatus;
  getSupportedStrategies(): string[];
  checkPermissions(type: WakeLockType): Promise<PermissionState | null>;
  destroy(): void;
}
```

### Options

```typescript
interface WakeLockOptions {
  strategies?: FallbackStrategy[]; // Custom fallback strategies
  debug?: boolean; // Enable debug logging
  batteryOptimization?: boolean; // Auto-release on low battery
  performanceMonitoring?: boolean; // Track performance metrics
  passive?: boolean; // Fail silently on permission prompts
}

interface RequestOptions {
  passive?: boolean; // Override global passive setting
  timeout?: number; // Request timeout in milliseconds
  retryAttempts?: number; // Number of retry attempts
  signal?: AbortSignal; // AbortController signal
}
```

## Fallback Strategy Hierarchy

1. **Screen Wake Lock API** - Modern browsers (Chrome 84+, Edge 84+, Safari 16.4+)
2. **Video Element Strategy** - iOS Safari and older browsers
3. **Audio Context Strategy** - When video fails
4. **Timer Strategy** - Last resort fallback

## Advanced Features

### Passive Mode

Prevent disruptive permission prompts:

```typescript
const wakeLock = new WakeLock({ passive: true });

// Will fail silently if permission prompt would be shown
await wakeLock.request('screen', { passive: true });
```

### Battery Optimization

```typescript
const wakeLock = new WakeLock({
  batteryOptimization: true,
  performanceMonitoring: true,
});

wakeLock.on('battery-change', ({ level, charging }) => {
  console.log(`Battery: ${level * 100}%, Charging: ${charging}`);
});

wakeLock.on('performance', metrics => {
  console.log('CPU Usage:', metrics.cpuUsage);
  console.log('Memory Usage:', metrics.memoryUsage);
});
```

### Custom Fallback Strategies

```typescript
class CustomStrategy implements FallbackStrategy {
  name = 'custom-strategy';
  priority = 5;

  isSupported(): boolean {
    return /* your support detection */;
  }

  async request(type: WakeLockType): Promise<WakeLockSentinel> {
    // Your implementation
  }
}

const wakeLock = new WakeLock({
  strategies: [new CustomStrategy()],
});
```

### Event System

```typescript
wakeLock.on('enabled', ({ type, strategy }) => {
  console.log(`Wake lock enabled: ${type} via ${strategy}`);
});

wakeLock.on('disabled', ({ type, reason }) => {
  console.log(`Wake lock disabled: ${type} (${reason})`);
});

wakeLock.on('error', ({ error, strategy }) => {
  console.error(`Wake lock error in ${strategy}:`, error);
});

wakeLock.on('fallback', ({ from, to, reason }) => {
  console.log(`Fallback from ${from} to ${to}: ${reason}`);
});
```

## Framework Integrations

### React

```typescript
// Basic usage
const { isActive, request, release } = useWakeLock();

// With auto-request
const wakeLock = useWakeLock({
  autoRequest: true,
  type: 'screen'
});

// With context
<WakeLockProvider options={{ debug: true }}>
  <App />
</WakeLockProvider>
```

### Vue

```typescript
// Composable
const { isActive, request, release } = useWakeLock();

// Plugin
app.use(WakeLockPlugin, { debug: true });

// Directive
<div v-wake-lock="{ autoRequest: true }">
  Video content
</div>
```

### Angular

```typescript
// Service injection
constructor(private wakeLockService: WakeLockService) {}

// Module
@NgModule({
  imports: [WakeLockModule],
  providers: [
    ...provideWakeLock({ debug: true })
  ]
})

// Directive
<div wakeLock [wakeLockAutoRequest]="true">
  Video content
</div>
```

## Browser Support

| Browser       | Screen Wake Lock API | Video Fallback | Audio Fallback | Timer Fallback |
| ------------- | -------------------- | -------------- | -------------- | -------------- |
| Chrome 84+    | ✅                   | ✅             | ✅             | ✅             |
| Edge 84+      | ✅                   | ✅             | ✅             | ✅             |
| Safari 16.4+  | ✅                   | ✅             | ✅             | ✅             |
| Safari < 16.4 | ❌                   | ✅             | ✅             | ✅             |
| Firefox       | ❌                   | ✅             | ✅             | ✅             |
| Mobile Safari | ❌                   | ✅             | ✅             | ✅             |

## Performance

- **Bundle Size**: 23KB gzipped (excellent for the feature set)
- **Runtime Overhead**: Minimal CPU and memory usage
- **Battery Impact**: Optimized with automatic release on low battery
- **Startup Time**: < 50ms initialization
- **Framework Support**: Optional peer dependencies (no forced bundle size increase)

## Security & Privacy

- No data collection or tracking
- Respects user permission preferences
- Automatic cleanup on page unload
- CSP (Content Security Policy) compatible

## Testing

The library includes a comprehensive test suite with **25/25 tests passing** using Vitest:

```bash
# Run tests
pnpm test

# Run tests in watch mode
pnpm run test:watch

# Run tests with UI
pnpm run test:ui
```

## Development

```bash
# Clone repository
git clone https://github.com/Emmanuelnoi/awake-lock.git

# Install dependencies (using pnpm)
pnpm install

# Run development build with watch mode
pnpm run dev

# Run tests
pnpm test

# Build library
pnpm run build

# Run linting
pnpm run lint

# Type checking
pnpm run typecheck

# Format code
pnpm run format
```

## Version History

### v1.0.0 (Production Ready! 🎉)

**Major Features:**

- ✅ Complete wake lock system with 4 fallback strategies
- ✅ Framework integrations for React, Vue, and Angular
- ✅ TypeScript with strict mode and comprehensive type safety
- ✅ 25/25 tests passing with Vitest
- ✅ Safe peer dependency architecture (no framework conflicts)
- ✅ pnpm package management with optimized builds
- ✅ Battery optimization and performance monitoring
- ✅ MIT license and production-ready package metadata

**Technical Improvements:**

- Migrated from Jest to Vitest for better performance
- Migrated from npm to pnpm for faster installs
- Optimized bundle size: 23KB gzipped
- ESM, CJS, and UMD builds
- Professional build system with Rollup
- ESLint and Prettier configuration

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

- 🐛 [Report bugs](https://github.com/Emmanuelnoi/awake-lock/issues)
- 💡 [Request features](https://github.com/Emmanuelnoi/awake-lock/issues)
- 📖 [Documentation](https://github.com/Emmanuelnoi/awake-lock/wiki)
- 💬 [Discussions](https://github.com/Emmanuelnoi/awake-lock/discussions)

---

Made by [Emmanuel Noi](https://github.com/Emmanuelnoi)
