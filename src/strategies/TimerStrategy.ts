import {
  FallbackStrategy,
  WakeLockType,
  WakeLockSentinel,
  RequestOptions,
  WakeLockError,
  WakeLockErrorCode,
  InternalWakeLockSentinel,
} from '../types';
import { isSSR, generateUniqueId, isDocumentHidden } from '../utils/helpers';

export class TimerStrategy implements FallbackStrategy {
  public readonly name = 'timer';
  public readonly priority = 4;

  private activeTimers = new Map<
    string,
    {
      intervalId: ReturnType<typeof setInterval>;
      workerScript?: string;
      worker?: Worker;
      sentinel: InternalWakeLockSentinel;
    }
  >();

  private readonly DEFAULT_INTERVAL = 1000; // 1 second
  private readonly AGGRESSIVE_INTERVAL = 500; // 500ms for mobile
  private readonly WORKER_SCRIPT = `
    let intervalId;
    
    self.onmessage = function(e) {
      if (e.data.action === 'start') {
        intervalId = setInterval(() => {
          self.postMessage({ type: 'tick', timestamp: Date.now() });
        }, e.data.interval || 1000);
      } else if (e.data.action === 'stop') {
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
        self.close();
      }
    };
  `;

  public isSupported(): boolean {
    // Timer strategy is always supported as the last resort
    return !isSSR();
  }

  public async request(
    type: WakeLockType,
    _options: RequestOptions = {}
  ): Promise<WakeLockSentinel> {
    if (!this.isSupported()) {
      throw new WakeLockError(
        'Timer strategy is not supported in SSR environment',
        WakeLockErrorCode.NOT_SUPPORTED,
        this.name
      );
    }

    const sentinelId = generateUniqueId();
    const sentinel = this.createSentinel(sentinelId, type);

    try {
      const useWorker = this.shouldUseWorker();
      const interval = this.determineInterval();

      if (useWorker) {
        await this.setupWorkerTimer(sentinelId, interval, sentinel);
      } else {
        this.setupMainThreadTimer(sentinelId, interval, sentinel);
      }

      this.setupVisibilityHandling(sentinelId);

      return sentinel;
    } catch (error) {
      throw new WakeLockError(
        `Timer strategy failed to start: ${error instanceof Error ? error.message : 'Unknown error'}`,
        WakeLockErrorCode.STRATEGY_FAILED,
        this.name,
        error instanceof Error ? error : undefined
      );
    }
  }

  public async release(): Promise<void> {
    const releasePromises = Array.from(this.activeTimers.entries()).map(([id, timer]) => {
      return this.releaseSentinel(id, timer).catch(error => {
        console.warn(`Failed to release timer ${id}:`, error);
      });
    });

    await Promise.allSettled(releasePromises);
    this.activeTimers.clear();
  }

  private shouldUseWorker(): boolean {
    try {
      // Use worker if available and we're not in a worker already
      return (
        typeof Worker !== 'undefined' &&
        typeof window !== 'undefined' &&
        typeof (window as any).importScripts === 'undefined'
      );
    } catch {
      return false;
    }
  }

  private determineInterval(): number {
    // Use more aggressive intervals on mobile devices
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );

    return isMobile ? this.AGGRESSIVE_INTERVAL : this.DEFAULT_INTERVAL;
  }

  private async setupWorkerTimer(
    sentinelId: string,
    interval: number,
    sentinel: InternalWakeLockSentinel
  ): Promise<void> {
    try {
      const blob = new Blob([this.WORKER_SCRIPT], { type: 'application/javascript' });
      const workerScript = URL.createObjectURL(blob);
      const worker = new Worker(workerScript);

      worker.onmessage = e => {
        if (e.data.type === 'tick') {
          // Keep the main thread active by doing minimal work
          const now = Date.now();
          // Store timestamp to prevent optimization
          (globalThis as any).__wakeLockTimestamp = now;
        }
      };

      worker.onerror = error => {
        console.warn('Wake lock worker error:', error);
        // Fallback to main thread timer
        this.setupMainThreadTimer(sentinelId, interval, sentinel);
      };

      // Start the worker
      worker.postMessage({ action: 'start', interval });

      const timerInfo = this.activeTimers.get(sentinelId);
      if (timerInfo) {
        timerInfo.worker = worker;
        timerInfo.workerScript = workerScript;
      }
    } catch (error) {
      console.warn('Failed to setup worker timer, falling back to main thread:', error);
      this.setupMainThreadTimer(sentinelId, interval, sentinel);
    }
  }

  private setupMainThreadTimer(
    sentinelId: string,
    interval: number,
    sentinel: InternalWakeLockSentinel
  ): void {
    const intervalId = setInterval(() => {
      if (sentinel._released) {
        clearInterval(intervalId);
        return;
      }

      // Perform minimal CPU work to keep the system awake
      const now = Date.now();

      // Touch DOM slightly to prevent browser optimizations
      if (!isDocumentHidden()) {
        try {
          // Create and immediately remove a tiny element
          const el = document.createElement('div');
          el.style.position = 'absolute';
          el.style.top = '-1px';
          el.style.left = '-1px';
          el.style.width = '1px';
          el.style.height = '1px';
          el.style.opacity = '0';
          document.body.appendChild(el);
          document.body.removeChild(el);
        } catch {
          // Ignore DOM errors
        }
      }

      // Store timestamp to prevent dead code elimination
      (globalThis as any).__wakeLockTimestamp = now;
    }, interval);

    const timerInfo = this.activeTimers.get(sentinelId);
    if (timerInfo) {
      timerInfo.intervalId = intervalId;
    }
  }

  private setupVisibilityHandling(sentinelId: string): void {
    const handleVisibilityChange = (): void => {
      const timer = this.activeTimers.get(sentinelId);
      if (!timer || timer.sentinel._released) return;

      if (isDocumentHidden()) {
        // When document becomes hidden, use more aggressive timing
        this.adjustTimerAggression(sentinelId, true);
      } else {
        // When document becomes visible, return to normal timing
        this.adjustTimerAggression(sentinelId, false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Store cleanup function
    const timer = this.activeTimers.get(sentinelId);
    if (timer) {
      (timer as any).cleanupVisibility = () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }

  private adjustTimerAggression(sentinelId: string, aggressive: boolean): void {
    const timer = this.activeTimers.get(sentinelId);
    if (!timer || timer.sentinel._released) return;

    const newInterval = aggressive ? this.AGGRESSIVE_INTERVAL : this.DEFAULT_INTERVAL;

    if (timer.worker) {
      // Update worker interval
      timer.worker.postMessage({ action: 'stop' });
      timer.worker.postMessage({ action: 'start', interval: newInterval });
    } else {
      // Update main thread timer
      clearInterval(timer.intervalId);
      this.setupMainThreadTimer(sentinelId, newInterval, timer.sentinel);
    }
  }

  private createSentinel(sentinelId: string, type: WakeLockType): InternalWakeLockSentinel {
    const sentinel: InternalWakeLockSentinel = {
      type,
      get released(): boolean {
        return this._released;
      },
      _strategy: this,
      _releaseListeners: new Set(),
      _released: false,

      async release(): Promise<void> {
        if (this._released) return;

        const timer = (this._strategy as TimerStrategy).activeTimers.get(sentinelId);
        if (timer) {
          await (this._strategy as TimerStrategy).releaseSentinel(sentinelId, timer);
        }
      },

      addEventListener(type: 'release', listener: () => void): void {
        if (type === 'release') {
          this._releaseListeners.add(listener);
        }
      },

      removeEventListener(type: 'release', listener: () => void): void {
        if (type === 'release') {
          this._releaseListeners.delete(listener);
        }
      },
    };

    this.activeTimers.set(sentinelId, {
      intervalId: setInterval(() => {}, 0), // Placeholder, will be replaced
      sentinel,
    });

    return sentinel;
  }

  private async releaseSentinel(
    sentinelId: string,
    timer: {
      intervalId: ReturnType<typeof setInterval>;
      workerScript?: string;
      worker?: Worker;
      sentinel: InternalWakeLockSentinel;
    }
  ): Promise<void> {
    if (timer.sentinel._released) return;

    try {
      // Stop worker if exists
      if (timer.worker) {
        timer.worker.postMessage({ action: 'stop' });
        timer.worker.terminate();
        delete timer.worker;
      }

      // Stop main thread timer
      if (timer.intervalId) {
        clearInterval(timer.intervalId);
      }

      // Clean up worker script URL
      if (timer.workerScript) {
        URL.revokeObjectURL(timer.workerScript);
      }

      // Clean up visibility listener
      if ((timer as any).cleanupVisibility) {
        (timer as any).cleanupVisibility();
      }
    } catch (error) {
      console.warn('Error cleaning up timer:', error);
    } finally {
      timer.sentinel._released = true;
      this.activeTimers.delete(sentinelId);

      // Notify release listeners
      for (const listener of timer.sentinel._releaseListeners) {
        try {
          listener();
        } catch (error) {
          console.error('Error in release listener:', error);
        }
      }
      timer.sentinel._releaseListeners.clear();
    }
  }

  public getActiveTimersCount(): number {
    return this.activeTimers.size;
  }
}
