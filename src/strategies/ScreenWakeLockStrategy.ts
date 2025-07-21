import {
  FallbackStrategy,
  WakeLockType,
  WakeLockSentinel,
  RequestOptions,
  WakeLockError,
  WakeLockErrorCode,
  InternalWakeLockSentinel,
} from '../types';
import { isSSR, isWakeLockSupported, withTimeout } from '../utils/helpers';

export class ScreenWakeLockStrategy implements FallbackStrategy {
  public readonly name = 'screen-wake-lock';
  public readonly priority = 1;

  private activeSentinels = new Set<InternalWakeLockSentinel>();

  public isSupported(): boolean {
    return !isSSR() && isWakeLockSupported();
  }

  public async request(
    type: WakeLockType,
    options: RequestOptions = {}
  ): Promise<WakeLockSentinel> {
    if (!this.isSupported()) {
      throw new WakeLockError(
        'Screen Wake Lock API is not supported',
        WakeLockErrorCode.NOT_SUPPORTED,
        this.name
      );
    }

    if (type === 'system') {
      throw new WakeLockError(
        'System wake locks are not yet supported by the Screen Wake Lock API',
        WakeLockErrorCode.NOT_SUPPORTED,
        this.name
      );
    }

    try {
      const requestPromise = (navigator as Navigator & { wakeLock: { request: (type: string) => Promise<WakeLockSentinel> } }).wakeLock.request(type);
      const timeout = options.timeout ?? 10000; // 10 second default timeout

      const nativeSentinel =
        timeout > 0
          ? await withTimeout(requestPromise, timeout, options.signal)
          : await requestPromise;

      const wrappedSentinel = this.createWrappedSentinel(nativeSentinel);
      this.activeSentinels.add(wrappedSentinel);

      return wrappedSentinel;
    } catch (error) {
      if (error instanceof Error) {
        let errorCode = WakeLockErrorCode.UNKNOWN;

        switch (error.name) {
          case 'NotAllowedError':
            errorCode = WakeLockErrorCode.PERMISSION_DENIED;
            break;
          case 'NotSupportedError':
            errorCode = WakeLockErrorCode.NOT_SUPPORTED;
            break;
          case 'AbortError':
            errorCode = WakeLockErrorCode.TIMEOUT;
            break;
          default:
            if (error.message.includes('timeout')) {
              errorCode = WakeLockErrorCode.TIMEOUT;
            }
        }

        throw new WakeLockError(
          `Screen Wake Lock request failed: ${error.message}`,
          errorCode,
          this.name,
          error
        );
      }

      throw new WakeLockError(
        'Unknown error occurred while requesting screen wake lock',
        WakeLockErrorCode.UNKNOWN,
        this.name
      );
    }
  }

  public async release(): Promise<void> {
    const releasePromises = Array.from(this.activeSentinels).map(sentinel => {
      return sentinel.release().catch(error => {
        console.warn('Failed to release wake lock sentinel:', error);
      });
    });

    await Promise.allSettled(releasePromises);
    this.activeSentinels.clear();
  }

  public getActiveSentinels(): ReadonlySet<InternalWakeLockSentinel> {
    return this.activeSentinels;
  }

  private createWrappedSentinel(nativeSentinel: WakeLockSentinel): InternalWakeLockSentinel {
    const wrappedSentinel: InternalWakeLockSentinel = {
      type: nativeSentinel.type,
      get released(): boolean {
        return this._released || nativeSentinel.released;
      },
      _strategy: this,
      _releaseListeners: new Set(),
      _released: false,

      async release(): Promise<void> {
        if (this._released) return;

        try {
          await nativeSentinel.release();
        } finally {
          this._released = true;
          (this._strategy as ScreenWakeLockStrategy).activeSentinels.delete(this);

          // Notify all release listeners
          for (const listener of this._releaseListeners) {
            try {
              listener();
            } catch (error) {
              console.error('Error in release listener:', error);
            }
          }
          this._releaseListeners.clear();
        }
      },

      addEventListener(type: 'release', listener: () => void): void {
        if (type === 'release') {
          this._releaseListeners.add(listener);

          // Also listen to the native sentinel
          nativeSentinel.addEventListener('release', listener);
        }
      },

      removeEventListener(type: 'release', listener: () => void): void {
        if (type === 'release') {
          this._releaseListeners.delete(listener);
          nativeSentinel.removeEventListener('release', listener);
        }
      },
    };

    // Listen for native sentinel release events
    nativeSentinel.addEventListener('release', () => {
      if (!wrappedSentinel._released) {
        wrappedSentinel._released = true;
        this.activeSentinels.delete(wrappedSentinel);
      }
    });

    return wrappedSentinel;
  }
}
