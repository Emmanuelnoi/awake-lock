import {
  WakeLockOptions,
  WakeLockType,
  WakeLockSentinel,
  RequestOptions,
  WakeLockStatus,
  WakeLockEvents,
  WakeLockError,
  WakeLockErrorCode,
  FallbackStrategy,
  InternalWakeLockSentinel,
} from './types';
import { EventEmitter } from './utils/EventEmitter';
import { PermissionManager } from './PermissionManager';
import { PerformanceMonitor } from './PerformanceMonitor';
import { ScreenWakeLockStrategy } from './strategies/ScreenWakeLockStrategy';
import { VideoElementStrategy } from './strategies/VideoElementStrategy';
import { AudioContextStrategy } from './strategies/AudioContextStrategy';
import { TimerStrategy } from './strategies/TimerStrategy';
import { isSSR, isDocumentHidden } from './utils/helpers';

export class WakeLock extends EventEmitter<WakeLockEvents> {
  private readonly options: Required<WakeLockOptions>;
  private readonly permissionManager: PermissionManager;
  private readonly performanceMonitor: PerformanceMonitor;
  private readonly strategies: FallbackStrategy[];

  private activeSentinel: InternalWakeLockSentinel | null = null;
  private currentStrategy: FallbackStrategy | null = null;
  private isReleasing = false;
  private readonly maxRetries = 3;

  constructor(options: WakeLockOptions = {}) {
    super();

    this.options = {
      strategies: options.strategies || this.getDefaultStrategies(),
      debug: options.debug ?? false,
      batteryOptimization: options.batteryOptimization ?? true,
      performanceMonitoring: options.performanceMonitoring ?? true,
      passive: options.passive ?? false,
    };

    this.permissionManager = new PermissionManager();
    this.performanceMonitor = new PerformanceMonitor({
      enabled: this.options.performanceMonitoring,
      batteryThreshold: 0.15, // 15% battery threshold
      performanceThreshold: 85, // 85% CPU threshold
    });

    this.strategies = this.options.strategies
      .sort((a, b) => a.priority - b.priority)
      .filter(strategy => strategy.isSupported());

    this.initializeEventListeners();
    this.initializeVisibilityHandling();
  }

  public async request(
    type: WakeLockType = 'screen',
    options: RequestOptions = {}
  ): Promise<WakeLockSentinel> {
    if (isSSR()) {
      throw new WakeLockError(
        'Wake lock is not supported in server-side rendering',
        WakeLockErrorCode.NOT_SUPPORTED
      );
    }

    if (this.activeSentinel && !this.activeSentinel.released) {
      if (this.options.debug) {
        console.info('Wake lock already active, returning existing sentinel');
      }
      return this.activeSentinel;
    }

    const requestOptions: RequestOptions = {
      passive: options.passive ?? this.options.passive,
      timeout: options.timeout ?? 30000,
      retryAttempts: options.retryAttempts ?? this.maxRetries,
      ...options,
    };

    try {
      // Check permissions if in passive mode
      if (requestOptions.passive) {
        const canRequest = await this.permissionManager.canRequestWithoutPrompt(type);
        if (!canRequest && this.permissionManager.isPassiveModeRecommended()) {
          throw new WakeLockError(
            'Wake lock would require user prompt, but passive mode is enabled',
            WakeLockErrorCode.PERMISSION_DENIED
          );
        }
      }

      // Start performance monitoring if enabled
      if (this.options.performanceMonitoring) {
        await this.performanceMonitor.start();
      }

      // Try strategies in order of priority
      const sentinel = await this.tryStrategies(type, requestOptions);

      this.activeSentinel = sentinel;
      this.setupSentinelListeners(sentinel);

      this.emit('enabled', {
        type,
        strategy: this.currentStrategy?.name ?? 'unknown',
      });

      if (this.options.debug) {
        console.info(`Wake lock acquired using ${this.currentStrategy?.name} strategy`);
      }

      return sentinel;
    } catch (error) {
      this.emit('error', {
        error:
          error instanceof WakeLockError
            ? error
            : new WakeLockError(
                error instanceof Error ? error.message : 'Unknown error',
                WakeLockErrorCode.UNKNOWN
              ),
      });
      throw error;
    }
  }

  public async release(): Promise<void> {
    if (!this.activeSentinel || this.activeSentinel.released || this.isReleasing) {
      return;
    }

    this.isReleasing = true;

    try {
      await this.activeSentinel.release();

      this.emit('disabled', {
        type: this.activeSentinel.type,
        reason: 'manual-release',
      });

      if (this.options.debug) {
        console.info('Wake lock released');
      }
    } catch (error) {
      this.emit('error', {
        error:
          error instanceof WakeLockError
            ? error
            : new WakeLockError(
                error instanceof Error ? error.message : 'Failed to release wake lock',
                WakeLockErrorCode.UNKNOWN
              ),
      });
    } finally {
      this.activeSentinel = null;
      this.currentStrategy = null;
      this.isReleasing = false;

      // Stop performance monitoring
      this.performanceMonitor.stop();
    }
  }

  public isSupported(): boolean {
    return !isSSR() && this.strategies.length > 0;
  }

  public getStatus(): WakeLockStatus {
    const performanceMetrics = this.performanceMonitor.getLastMetrics();
    const batteryLevel = this.performanceMonitor.isLowBattery()
      ? (this.performanceMonitor.getLastMetrics()?.batteryDrain ?? null)
      : null;

    return {
      isActive: this.activeSentinel !== null && !this.activeSentinel.released,
      type: this.activeSentinel?.type ?? null,
      strategy: this.currentStrategy?.name ?? null,
      startTime: this.activeSentinel ? Date.now() : null,
      batteryLevel,
      performanceMetrics,
    };
  }

  public getSupportedStrategies(): string[] {
    return this.strategies.map(strategy => strategy.name);
  }

  public async checkPermissions(type: WakeLockType = 'screen'): Promise<PermissionState | null> {
    return await this.permissionManager.checkWakeLockPermission(type, this.options.passive);
  }

  public destroy(): void {
    this.release().catch(console.warn);
    this.performanceMonitor.stop();
    this.removeAllListeners();
  }

  private getDefaultStrategies(): FallbackStrategy[] {
    return [
      new ScreenWakeLockStrategy(),
      new VideoElementStrategy(),
      new AudioContextStrategy(),
      new TimerStrategy(),
    ];
  }

  private async tryStrategies(
    type: WakeLockType,
    options: RequestOptions
  ): Promise<InternalWakeLockSentinel> {
    const errors: WakeLockError[] = [];

    for (const strategy of this.strategies) {
      try {
        if (this.options.debug) {
          console.debug(`Trying strategy: ${strategy.name}`);
        }

        const sentinel = await this.performanceMonitor
          .measureStrategy(strategy.name, async () => {
            await strategy.request(type, options);
          })
          .then(async measurement => {
            if (this.options.debug) {
              console.debug(`Strategy ${strategy.name} took ${measurement.duration}ms`);
            }
            return await strategy.request(type, options);
          });

        this.currentStrategy = strategy;

        return sentinel as InternalWakeLockSentinel;
      } catch (error) {
        const wakeLockError =
          error instanceof WakeLockError
            ? error
            : new WakeLockError(
                error instanceof Error ? error.message : 'Strategy failed',
                WakeLockErrorCode.STRATEGY_FAILED,
                strategy.name
              );

        errors.push(wakeLockError);

        if (this.options.debug) {
          console.debug(`Strategy ${strategy.name} failed:`, wakeLockError.message);
        }

        // Emit fallback event
        const nextStrategy = this.strategies[this.strategies.indexOf(strategy) + 1];
        if (nextStrategy) {
          this.emit('fallback', {
            from: strategy.name,
            to: nextStrategy.name,
            reason: wakeLockError.message,
          });
        }
      }
    }

    // All strategies failed
    const finalError = new WakeLockError(
      `All wake lock strategies failed. Errors: ${errors.map(e => e.message).join(', ')}`,
      WakeLockErrorCode.STRATEGY_FAILED
    );

    throw finalError;
  }

  private setupSentinelListeners(sentinel: InternalWakeLockSentinel): void {
    const onRelease = (): void => {
      if (this.activeSentinel === sentinel) {
        this.emit('disabled', {
          type: sentinel.type,
          reason: 'automatic-release',
        });

        this.activeSentinel = null;
        this.currentStrategy = null;
        this.performanceMonitor.stop();
      }
    };

    sentinel.addEventListener('release', onRelease);
  }

  private initializeEventListeners(): void {
    // Battery change events
    this.performanceMonitor.on('battery-change', event => {
      this.emit('battery-change', event);

      if (this.options.batteryOptimization && event.level <= 0.15 && !event.charging) {
        this.handleLowBattery();
      }
    });

    // Performance events
    this.performanceMonitor.on('performance', metrics => {
      this.emit('performance', metrics);

      if (this.options.batteryOptimization && this.performanceMonitor.shouldOptimizePerformance()) {
        this.handlePerformanceOptimization();
      }
    });

    // Page unload - ensure cleanup
    if (!isSSR()) {
      const cleanup = (): void => {
        this.destroy();
      };

      window.addEventListener('beforeunload', cleanup);
      window.addEventListener('unload', cleanup);
    }
  }

  private initializeVisibilityHandling(): void {
    if (isSSR()) return;

    const handleVisibilityChange = (): void => {
      const isHidden = isDocumentHidden();

      this.emit('visibility-change', {
        hidden: isHidden,
        action: 'none',
      });

      // Optionally release wake lock when page is hidden
      if (isHidden && this.activeSentinel && this.options.batteryOptimization) {
        this.release().catch(console.warn);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
  }

  private handleLowBattery(): void {
    if (this.options.debug) {
      console.warn('Low battery detected, releasing wake lock for battery optimization');
    }

    this.release().catch(console.warn);
  }

  private handlePerformanceOptimization(): void {
    if (this.options.debug) {
      console.info('Performance optimization triggered');
    }

    // Could implement strategy switching here
    // For now, just emit recommendations
    const recommendations = this.performanceMonitor.getOptimizationRecommendations();
    if (recommendations.length > 0 && this.options.debug) {
      console.info('Performance recommendations:', recommendations);
    }
  }
}
