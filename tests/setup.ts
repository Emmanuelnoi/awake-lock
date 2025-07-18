// Vitest setup file for awake-lock tests

// Mock browser APIs that aren't available in jsdom
Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  value: vi.fn().mockImplementation(_callback => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  })),
});

// Mock MediaSource API
Object.defineProperty(window, 'MediaSource', {
  writable: true,
  value: vi.fn().mockImplementation(() => ({
    readyState: 'open',
    addSourceBuffer: vi.fn().mockReturnValue({
      appendBuffer: vi.fn(),
      addEventListener: vi.fn(),
    }),
    endOfStream: vi.fn(),
    addEventListener: vi.fn(),
  })),
});

// Mock Web Audio API
Object.defineProperty(window, 'AudioContext', {
  writable: true,
  value: vi.fn().mockImplementation(() => ({
    state: 'running',
    currentTime: 0,
    destination: {},
    resume: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    createOscillator: vi.fn().mockReturnValue({
      frequency: {
        setValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    }),
    createGain: vi.fn().mockReturnValue({
      gain: {
        setValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
    }),
  })),
});

// Mock Worker API
Object.defineProperty(window, 'Worker', {
  writable: true,
  value: vi.fn().mockImplementation(() => ({
    postMessage: vi.fn(),
    terminate: vi.fn(),
    onmessage: null,
    onerror: null,
  })),
});

// Mock Navigator APIs
Object.defineProperty(navigator, 'wakeLock', {
  writable: true,
  value: {
    request: vi.fn().mockResolvedValue({
      type: 'screen',
      released: false,
      release: vi.fn().mockResolvedValue(undefined),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  },
});

Object.defineProperty(navigator, 'permissions', {
  writable: true,
  value: {
    query: vi.fn().mockResolvedValue({
      state: 'granted',
    }),
  },
});

Object.defineProperty(navigator, 'getBattery', {
  writable: true,
  value: vi.fn().mockResolvedValue({
    level: 0.8,
    charging: false,
    chargingTime: Infinity,
    dischargingTime: 3600,
    onlevelchange: null,
    onchargingchange: null,
    onchargingtimechange: null,
    ondischargingtimechange: null,
  }),
});

// Mock document APIs
Object.defineProperty(document, 'visibilityState', {
  writable: true,
  value: 'visible',
});

Object.defineProperty(document, 'hidden', {
  writable: true,
  value: false,
});

// Mock performance API
Object.defineProperty(window, 'performance', {
  writable: true,
  value: {
    now: vi.fn().mockReturnValue(Date.now()),
    memory: {
      usedJSHeapSize: 1024 * 1024 * 10, // 10MB
    },
  },
});

// Mock URL API
Object.defineProperty(window, 'URL', {
  writable: true,
  value: {
    createObjectURL: vi.fn().mockReturnValue('blob:mock-url'),
    revokeObjectURL: vi.fn(),
  },
});

// Mock Blob API
Object.defineProperty(window, 'Blob', {
  writable: true,
  value: vi.fn().mockImplementation((content, options) => ({
    size: content ? content.length : 0,
    type: options?.type || '',
  })),
});

// Global test utilities
declare global {
  namespace Vi {
    interface AsymmetricMatchersContaining {
      toBeWakeLockSentinel(): any;
    }
  }
}

// Custom Vitest matchers
expect.extend({
  toBeWakeLockSentinel(received) {
    const pass =
      received &&
      typeof received === 'object' &&
      'type' in received &&
      'released' in received &&
      'release' in received &&
      'addEventListener' in received &&
      'removeEventListener' in received;

    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid WakeLockSentinel`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${received} to be a valid WakeLockSentinel with type, released, release, addEventListener, and removeEventListener properties`,
        pass: false,
      };
    }
  },
});

// Global test helpers
export const createMockWakeLockSentinel = (type: 'screen' | 'system' = 'screen') => ({
  type,
  released: false,
  release: vi.fn().mockResolvedValue(undefined),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
});

export const createMockBatteryManager = (level = 0.8, charging = false) => ({
  level,
  charging,
  chargingTime: charging ? 3600 : Infinity,
  dischargingTime: charging ? Infinity : 3600,
  onlevelchange: null,
  onchargingchange: null,
  onchargingtimechange: null,
  ondischargingtimechange: null,
});

// Test environment setup
beforeEach(() => {
  // Reset all mocks before each test
  vi.clearAllMocks();

  // Reset document visibility state
  Object.defineProperty(document, 'visibilityState', {
    writable: true,
    value: 'visible',
  });

  // Reset navigator.wakeLock mock
  if (navigator.wakeLock) {
    (navigator.wakeLock.request as any).mockResolvedValue(createMockWakeLockSentinel());
  }
});

afterEach(() => {
  // Clean up any timers only if they are mocked
  if (vi.isFakeTimers()) {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  }
});
