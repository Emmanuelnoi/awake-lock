// Type stubs for when Vue is not available
declare module 'vue' {
  export interface Ref<T> {
    value: T;
  }
  export function ref<T>(value: T): Ref<T>;
  export function reactive<T extends object>(obj: T): T;
  export function onMounted(fn: () => void): void;
  export function onUnmounted(fn: () => void): void;
  export function watch<T>(source: T, fn: (newVal: T, oldVal: T) => void): void;
  export function computed<T>(fn: () => T): Ref<T>;
  export function inject<T>(key: string | symbol, defaultValue?: T): T;
  export function defineStore<T>(id: string, store: T): () => T;
  export function toRefs<T extends object>(obj: T): { [K in keyof T]: Ref<T[K]> };
}

import {
  ref,
  reactive,
  onMounted,
  onUnmounted,
  computed,
  inject,
  defineStore,
  toRefs,
  type Ref,
} from 'vue';
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
  isActive: Ref<boolean>;
  status: Ref<WakeLockStatus>;
  request: (type?: WakeLockType, options?: RequestOptions) => Promise<WakeLockSentinel>;
  release: () => Promise<void>;
  error: Ref<Error | null>;
  isLoading: Ref<boolean>;
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

  let wakeLock: WakeLock | null = null;

  const isActive = ref(false);
  const status = ref<WakeLockStatus>({
    isActive: false,
    type: null,
    strategy: null,
    startTime: null,
    batteryLevel: null,
    performanceMetrics: null,
  });
  const error = ref<Error | null>(null);
  const isLoading = ref(false);

  const isSupported = computed(() => wakeLock?.isSupported() ?? false);

  const setupEventListeners = (): void => {
    if (!wakeLock) return;

    wakeLock.on('enabled', event => {
      isActive.value = true;
      status.value = wakeLock!.getStatus();
      error.value = null;
      onEnabled?.(event);
    });

    wakeLock.on('disabled', event => {
      isActive.value = false;
      status.value = wakeLock!.getStatus();
      onDisabled?.(event);
    });

    wakeLock.on('error', event => {
      error.value = event.error;
      isLoading.value = false;
      onError?.(event);
    });

    wakeLock.on('battery-change', event => {
      status.value = wakeLock!.getStatus();
      onBatteryChange?.(event);
    });

    wakeLock.on('performance', event => {
      status.value = wakeLock!.getStatus();
      onPerformance?.(event);
    });

    wakeLock.on('fallback', event => {
      onFallback?.(event);
    });

    wakeLock.on('visibility-change', event => {
      onVisibilityChange?.(event);
    });
  };

  const request = async (
    requestType: WakeLockType = type,
    options: RequestOptions = requestOptions
  ): Promise<WakeLockSentinel> => {
    if (!wakeLock) {
      throw new Error('WakeLock not initialized');
    }

    isLoading.value = true;
    error.value = null;

    try {
      const sentinel = await wakeLock.request(requestType, options);
      isLoading.value = false;
      return sentinel;
    } catch (err) {
      isLoading.value = false;
      const errorObj = err instanceof Error ? err : new Error('Unknown error');
      error.value = errorObj;
      throw errorObj;
    }
  };

  const release = async (): Promise<void> => {
    if (!wakeLock) return;

    try {
      await wakeLock.release();
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Failed to release wake lock');
      error.value = errorObj;
      throw errorObj;
    }
  };

  onMounted(() => {
    wakeLock = new WakeLock(wakeLockOptions);
    setupEventListeners();

    // Auto-request wake lock if enabled
    if (autoRequest) {
      isLoading.value = true;
      wakeLock
        .request(type, requestOptions)
        .then(() => {
          isLoading.value = false;
        })
        .catch(err => {
          error.value = err;
          isLoading.value = false;
        });
    }
  });

  onUnmounted(() => {
    if (wakeLock) {
      wakeLock.destroy();
      wakeLock = null;
    }
  });

  return {
    isSupported: isSupported.value,
    isActive,
    status,
    request,
    release,
    error,
    isLoading,
  };
}

// Plugin for Vue 3
export interface WakeLockPluginOptions extends WakeLockOptions {
  globalProperty?: string;
}

export const WakeLockPlugin = {
  install(app: any, options: WakeLockPluginOptions = {}) {
    const { globalProperty = '$wakeLock', ...wakeLockOptions } = options;

    const wakeLock = new WakeLock(wakeLockOptions);

    app.config.globalProperties[globalProperty] = wakeLock;

    app.provide('wakeLock', wakeLock);

    // Cleanup on app unmount
    app.config.globalProperties.$wakeLockCleanup = () => {
      wakeLock.destroy();
    };
  },
};

// Composition API inject
export function injectWakeLock(): WakeLock {
  const wakeLock = inject('wakeLock') as WakeLock;
  if (!wakeLock) {
    throw new Error('WakeLock not provided. Make sure to install the WakeLockPlugin.');
  }
  return wakeLock;
}

// Vue directive for automatic wake lock management
export const vWakeLock = {
  mounted(el: HTMLElement, binding: any) {
    const wakeLock = new WakeLock(binding.value || {});

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          wakeLock.request().catch(console.warn);
        } else {
          wakeLock.release().catch(console.warn);
        }
      });
    });

    observer.observe(el);

    // Store for cleanup
    (el as any).__wakeLock = wakeLock;
    (el as any).__wakeLockObserver = observer;
  },

  unmounted(el: HTMLElement) {
    const wakeLock = (el as any).__wakeLock;
    const observer = (el as any).__wakeLockObserver;

    if (wakeLock) {
      wakeLock.destroy();
    }

    if (observer) {
      observer.disconnect();
    }
  },
};

// Pinia store (if using Pinia)
export interface WakeLockState {
  isActive: boolean;
  status: WakeLockStatus;
  error: Error | null;
  isLoading: boolean;
}

export function useWakeLockStore() {
  return defineStore('wakeLock', () => {
    const wakeLock = new WakeLock();

    const state = reactive<WakeLockState>({
      isActive: false,
      status: {
        isActive: false,
        type: null,
        strategy: null,
        startTime: null,
        batteryLevel: null,
        performanceMetrics: null,
      },
      error: null,
      isLoading: false,
    });

    wakeLock.on('enabled', () => {
      state.isActive = true;
      state.status = wakeLock.getStatus();
      state.error = null;
    });

    wakeLock.on('disabled', () => {
      state.isActive = false;
      state.status = wakeLock.getStatus();
    });

    wakeLock.on('error', event => {
      state.error = event.error;
      state.isLoading = false;
    });

    const request = async (
      type: WakeLockType = 'screen',
      options: RequestOptions = {}
    ): Promise<WakeLockSentinel> => {
      state.isLoading = true;
      state.error = null;

      try {
        const sentinel = await wakeLock.request(type, options);
        state.isLoading = false;
        return sentinel;
      } catch (err) {
        state.isLoading = false;
        const error = err instanceof Error ? err : new Error('Unknown error');
        state.error = error;
        throw error;
      }
    };

    const release = async (): Promise<void> => {
      try {
        await wakeLock.release();
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to release wake lock');
        state.error = error;
        throw error;
      }
    };

    const isSupported = computed(() => wakeLock.isSupported());

    return {
      // State
      ...toRefs(state),

      // Getters
      isSupported,

      // Actions
      request,
      release,

      // Cleanup
      $dispose: () => wakeLock.destroy(),
    };
  });
}

// For backward compatibility with Vue 2
export const WakeLockMixin = {
  data() {
    return {
      wakeLock: null as WakeLock | null,
      wakeLockActive: false,
      wakeLockError: null as Error | null,
      wakeLockLoading: false,
    };
  },

  mounted(): void {
    const instance = this as any;
    instance.wakeLock = new WakeLock();

    instance.wakeLock.on('enabled', () => {
      instance.wakeLockActive = true;
      instance.wakeLockError = null;
    });

    instance.wakeLock.on('disabled', () => {
      instance.wakeLockActive = false;
    });

    instance.wakeLock.on('error', (event: any) => {
      instance.wakeLockError = event.error;
      instance.wakeLockLoading = false;
    });
  },

  beforeDestroy(): void {
    const instance = this as any;
    if (instance.wakeLock) {
      instance.wakeLock.destroy();
    }
  },

  methods: {
    async requestWakeLock(
      type: WakeLockType = 'screen',
      options: RequestOptions = {}
    ): Promise<WakeLockSentinel> {
      const instance = this as any;
      if (!instance.wakeLock) throw new Error('WakeLock not initialized');

      instance.wakeLockLoading = true;
      instance.wakeLockError = null;

      try {
        const sentinel = await instance.wakeLock.request(type, options);
        instance.wakeLockLoading = false;
        return sentinel;
      } catch (err) {
        instance.wakeLockLoading = false;
        instance.wakeLockError = err instanceof Error ? err : new Error('Unknown error');
        throw err;
      }
    },

    async releaseWakeLock(): Promise<void> {
      const instance = this as any;
      if (!instance.wakeLock) return;

      try {
        await instance.wakeLock.release();
      } catch (err) {
        instance.wakeLockError =
          err instanceof Error ? err : new Error('Failed to release wake lock');
        throw err;
      }
    },
  },
};

// Re-export Vue types for convenience
export type { Ref, UnwrapRef, ComputedRef } from 'vue';
