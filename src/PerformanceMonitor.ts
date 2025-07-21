import { PerformanceMetrics, BatteryManager, WakeLockEvents } from './types';
import { EventEmitter } from './utils/EventEmitter';
import {
  isSSR,
  getBattery,
  getPerformanceNow,
  getMemoryUsage,
  throttle,
  isLowPowerMode,
} from './utils/helpers';

export class PerformanceMonitor extends EventEmitter<WakeLockEvents> {
  private readonly enabled: boolean;
  private readonly monitoringInterval: number;
  private readonly batteryThreshold: number;
  private readonly performanceThreshold: number;

  private monitoringTimer: ReturnType<typeof setInterval> | null = null;
  private battery: BatteryManager | null = null;
  private lastMetrics: PerformanceMetrics | null = null;
  private isMonitoring = false;

  private readonly throttledEmitPerformance = throttle(
    (metrics: PerformanceMetrics) => this.emit('performance', metrics),
    1000 // Throttle performance events to once per second
  );

  constructor(
    options: {
      enabled?: boolean;
      monitoringInterval?: number;
      batteryThreshold?: number;
      performanceThreshold?: number;
    } = {}
  ) {
    super();

    this.enabled = options.enabled ?? true;
    this.monitoringInterval = options.monitoringInterval ?? 5000; // 5 seconds
    this.batteryThreshold = options.batteryThreshold ?? 0.2; // 20%
    this.performanceThreshold = options.performanceThreshold ?? 80; // 80% CPU
  }

  public async start(): Promise<void> {
    if (!this.enabled || this.isMonitoring || isSSR()) return;

    this.isMonitoring = true;

    try {
      // Initialize battery monitoring
      await this.initializeBatteryMonitoring();

      // Start periodic performance monitoring
      this.startPerformanceMonitoring();

      // Take initial measurement
      const initialMetrics = await this.collectMetrics();
      this.lastMetrics = initialMetrics;
      this.throttledEmitPerformance(initialMetrics);
    } catch (error) {
      console.warn('Failed to start performance monitoring:', error);
      this.isMonitoring = false;
    }
  }

  public stop(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;

    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }

    // Remove battery event listeners
    if (this.battery) {
      this.battery.onlevelchange = null;
      this.battery.onchargingchange = null;
    }
  }

  public async getCurrentMetrics(): Promise<PerformanceMetrics> {
    return await this.collectMetrics();
  }

  public getLastMetrics(): PerformanceMetrics | null {
    return this.lastMetrics;
  }

  public isLowBattery(): boolean {
    if (!this.battery) return false;
    return this.battery.level <= this.batteryThreshold;
  }

  public isHighCpuUsage(): boolean {
    if (!this.lastMetrics) return false;
    return this.lastMetrics.cpuUsage >= this.performanceThreshold;
  }

  public shouldOptimizePerformance(): boolean {
    return this.isLowBattery() || this.isHighCpuUsage() || isLowPowerMode();
  }

  private async initializeBatteryMonitoring(): Promise<void> {
    try {
      this.battery = await getBattery();
      if (!this.battery) return;

      // Listen for battery level changes
      this.battery.onlevelchange = (): void => {
        if (this.battery) {
          this.emit('battery-change', {
            level: this.battery.level,
            charging: this.battery.charging,
          });

          // Check if battery is critically low
          if (this.isLowBattery()) {
            this.handleLowBattery();
          }
        }
      };

      // Listen for charging state changes
      this.battery.onchargingchange = (): void => {
        if (this.battery) {
          this.emit('battery-change', {
            level: this.battery.level,
            charging: this.battery.charging,
          });
        }
      };

      // Emit initial battery state
      this.emit('battery-change', {
        level: this.battery.level,
        charging: this.battery.charging,
      });
    } catch (error) {
      console.warn('Failed to initialize battery monitoring:', error);
    }
  }

  private startPerformanceMonitoring(): void {
    this.monitoringTimer = setInterval(async () => {
      if (!this.isMonitoring) return;

      try {
        const metrics = await this.collectMetrics();
        this.lastMetrics = metrics;
        this.throttledEmitPerformance(metrics);

        // Check for performance issues
        if (this.shouldOptimizePerformance()) {
          this.handlePerformanceOptimization();
        }
      } catch (error) {
        console.warn('Error collecting performance metrics:', error);
      }
    }, this.monitoringInterval);
  }

  private async collectMetrics(): Promise<PerformanceMetrics> {
    const timestamp = getPerformanceNow();

    // Collect CPU usage estimate
    const cpuUsage = await this.estimateCpuUsage();

    // Collect memory usage
    const memoryUsage = getMemoryUsage();

    // Estimate battery drain rate
    const batteryDrain = this.estimateBatteryDrain();

    return {
      cpuUsage,
      memoryUsage,
      batteryDrain,
      timestamp,
    };
  }

  private async estimateCpuUsage(): Promise<number> {
    if (isSSR()) return 0;

    try {
      // Use performance.now() to measure CPU intensive operations
      const start = getPerformanceNow();
      const iterations = 100000;

      // Perform a CPU-intensive calculation
      let result = 0;
      for (let i = 0; i < iterations; i++) {
        result += Math.random() * Math.sin(i);
      }

      const end = getPerformanceNow();
      const duration = end - start;

      // Normalize to percentage (this is a rough estimation)
      // Lower duration = higher CPU performance = lower usage
      const normalizedUsage = Math.min(100, Math.max(0, (duration / 10) * 100));

      // Prevent dead code elimination
      (globalThis as Record<string, unknown>).__performanceTestResult = result;

      return normalizedUsage;
    } catch {
      return 0;
    }
  }

  private estimateBatteryDrain(): number {
    if (!this.battery || !this.lastMetrics) return 0;

    try {
      const timeDiff = Date.now() - this.lastMetrics.timestamp;
      if (timeDiff === 0) return 0;

      // This is a simplified battery drain estimation
      // In reality, you'd need more sophisticated monitoring
      const baselineDrain = 0.01; // 1% per hour baseline
      const wakeLockMultiplier = 1.5; // 50% increase due to wake lock

      return baselineDrain * wakeLockMultiplier;
    } catch {
      return 0;
    }
  }

  private handleLowBattery(): void {
    console.warn('Low battery detected, consider optimizing wake lock usage');
    // The main WakeLock class will listen to battery-change events
    // and can take appropriate action
  }

  private handlePerformanceOptimization(): void {
    console.info('Performance optimization recommended');
    // Emit performance event with current metrics
    if (this.lastMetrics) {
      this.throttledEmitPerformance(this.lastMetrics);
    }
  }

  public getOptimizationRecommendations(): string[] {
    const recommendations: string[] = [];

    if (this.isLowBattery()) {
      recommendations.push('Consider releasing wake lock due to low battery');
    }

    if (this.isHighCpuUsage()) {
      recommendations.push(
        'High CPU usage detected, consider using less aggressive wake lock strategy'
      );
    }

    if (isLowPowerMode()) {
      recommendations.push('Device is in low power mode, consider passive wake lock mode');
    }

    if (this.lastMetrics && this.lastMetrics.memoryUsage > 50 * 1024 * 1024) {
      // 50MB
      recommendations.push('High memory usage detected, consider optimizing wake lock strategy');
    }

    return recommendations;
  }

  public async measureStrategy(
    strategyName: string,
    operation: () => Promise<void>
  ): Promise<{
    duration: number;
    cpuBefore: number;
    cpuAfter: number;
    memoryBefore: number;
    memoryAfter: number;
  }> {
    const start = getPerformanceNow();
    const cpuBefore = await this.estimateCpuUsage();
    const memoryBefore = getMemoryUsage();

    await operation();

    const end = getPerformanceNow();
    const cpuAfter = await this.estimateCpuUsage();
    const memoryAfter = getMemoryUsage();

    const measurement = {
      duration: end - start,
      cpuBefore,
      cpuAfter,
      memoryBefore,
      memoryAfter,
    };

    console.debug(`Strategy ${strategyName} performance:`, measurement);
    return measurement;
  }
}
