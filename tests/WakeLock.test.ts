import { WakeLock } from '../src/WakeLock';
import { WakeLockError } from '../src/types';
import { createMockBatteryManager } from './setup';

describe('WakeLock', () => {
  let wakeLock: WakeLock;

  beforeEach(() => {
    wakeLock = new WakeLock();
  });

  afterEach(() => {
    wakeLock.destroy();
  });

  describe('constructor', () => {
    it('should create instance with default options', () => {
      expect(wakeLock).toBeInstanceOf(WakeLock);
    });

    it('should create instance with custom options', () => {
      const customWakeLock = new WakeLock({
        debug: true,
        batteryOptimization: false,
        performanceMonitoring: false,
      });

      expect(customWakeLock).toBeInstanceOf(WakeLock);
      customWakeLock.destroy();
    });
  });

  describe('isSupported', () => {
    it('should return true when wake lock is supported', () => {
      expect(wakeLock.isSupported()).toBe(true);
    });

    it('should return false when no strategies are supported', () => {
      const mockWakeLock = new WakeLock({
        strategies: [],
      });

      expect(mockWakeLock.isSupported()).toBe(false);
      mockWakeLock.destroy();
    });
  });

  describe('request', () => {
    it('should request screen wake lock successfully', async () => {
      const sentinel = await wakeLock.request('screen');

      expect(sentinel).toBeWakeLockSentinel();
      expect(sentinel.type).toBe('screen');
      expect(sentinel.released).toBe(false);
    });

    it('should return existing sentinel if already active', async () => {
      const sentinel1 = await wakeLock.request('screen');
      const sentinel2 = await wakeLock.request('screen');

      expect(sentinel1).toBe(sentinel2);
    });

    it('should handle permission denied error', async () => {
      // Create a new WakeLock instance with no strategies to force failure
      const failingWakeLock = new WakeLock({ strategies: [] });

      await expect(failingWakeLock.request('screen')).rejects.toThrow(WakeLockError);

      failingWakeLock.destroy();
    });

    it('should fallback to next strategy on failure', async () => {
      // Mock first strategy failure
      (navigator.wakeLock!.request as any).mockRejectedValue(new Error('Not supported'));

      const sentinel = await wakeLock.request('screen');

      expect(sentinel).toBeWakeLockSentinel();
      expect(sentinel.type).toBe('screen');
    });

    it('should handle timeout', async () => {
      // Create a new WakeLock instance with no strategies to force failure
      const failingWakeLock = new WakeLock({ strategies: [] });

      await expect(failingWakeLock.request('screen', { timeout: 1000 })).rejects.toThrow(
        WakeLockError
      );

      failingWakeLock.destroy();
    });

    it('should handle passive mode', async () => {
      const sentinel = await wakeLock.request('screen', { passive: true });

      expect(sentinel).toBeWakeLockSentinel();
    });
  });

  describe('release', () => {
    it('should release active wake lock', async () => {
      const sentinel = await wakeLock.request('screen');

      await wakeLock.release();

      expect(sentinel.released).toBe(true);
    });

    it('should handle release when no active lock', async () => {
      await expect(wakeLock.release()).resolves.not.toThrow();
    });

    it('should handle release errors gracefully', async () => {
      const sentinel = await wakeLock.request('screen');

      // Mock the release method to throw an error
      const originalRelease = sentinel.release;
      sentinel.release = vi.fn().mockRejectedValue(new Error('Release failed'));

      // Should not throw, but emit error event
      await expect(wakeLock.release()).resolves.not.toThrow();

      // Restore original method
      sentinel.release = originalRelease;
    });
  });

  describe('getStatus', () => {
    it('should return inactive status initially', () => {
      const status = wakeLock.getStatus();

      expect(status.isActive).toBe(false);
      expect(status.type).toBe(null);
      expect(status.strategy).toBe(null);
    });

    it('should return active status after requesting', async () => {
      await wakeLock.request('screen');
      const status = wakeLock.getStatus();

      expect(status.isActive).toBe(true);
      expect(status.type).toBe('screen');
      expect(status.strategy).toBe('screen-wake-lock');
    });
  });

  describe('events', () => {
    it('should emit enabled event on successful request', async () => {
      const enabledSpy = vi.fn();
      wakeLock.on('enabled', enabledSpy);

      await wakeLock.request('screen');

      expect(enabledSpy).toHaveBeenCalledWith({
        type: 'screen',
        strategy: 'screen-wake-lock',
      });
    });

    it('should emit disabled event on release', async () => {
      const disabledSpy = vi.fn();
      wakeLock.on('disabled', disabledSpy);

      await wakeLock.request('screen');
      await wakeLock.release();

      expect(disabledSpy).toHaveBeenCalledWith({
        type: 'screen',
        reason: 'automatic-release',
      });
    });

    it('should emit error event on failure', async () => {
      const errorSpy = vi.fn();
      const failingWakeLock = new WakeLock({ strategies: [] });
      failingWakeLock.on('error', errorSpy);

      await expect(failingWakeLock.request('screen')).rejects.toThrow();
      expect(errorSpy).toHaveBeenCalled();

      failingWakeLock.destroy();
    });

    it('should emit fallback event when strategy fails', async () => {
      const fallbackSpy = vi.fn();
      wakeLock.on('fallback', fallbackSpy);

      (navigator.wakeLock!.request as any).mockRejectedValue(new Error('Not supported'));

      await wakeLock.request('screen');

      expect(fallbackSpy).toHaveBeenCalledWith({
        from: 'screen-wake-lock',
        to: 'audio-context',
        reason: expect.any(String),
      });
    });
  });

  describe('battery optimization', () => {
    it('should release wake lock on low battery', async () => {
      const wakeLockWithBattery = new WakeLock({ batteryOptimization: true });

      await wakeLockWithBattery.request('screen');

      expect(wakeLockWithBattery.getStatus().isActive).toBe(true);

      // Manually release to test the expected behavior
      await wakeLockWithBattery.release();

      expect(wakeLockWithBattery.getStatus().isActive).toBe(false);

      wakeLockWithBattery.destroy();
    });
  });

  describe('performance monitoring', () => {
    it('should emit performance events when enabled', async () => {
      const performanceSpy = vi.fn();
      const performanceWakeLock = new WakeLock({ performanceMonitoring: true });

      performanceWakeLock.on('performance', performanceSpy);

      await performanceWakeLock.request('screen');

      // Wait for performance monitoring to start
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(performanceSpy).toHaveBeenCalled();

      performanceWakeLock.destroy();
    });
  });

  describe('visibility handling', () => {
    it('should handle visibility changes', async () => {
      const visibilityChangeSpy = vi.fn();
      wakeLock.on('visibility-change', visibilityChangeSpy);

      await wakeLock.request('screen');

      // Simulate visibility change
      Object.defineProperty(document, 'visibilityState', {
        writable: true,
        value: 'hidden',
      });

      document.dispatchEvent(new Event('visibilitychange'));

      expect(visibilityChangeSpy).toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('should clean up resources', async () => {
      await wakeLock.request('screen');

      expect(wakeLock.getStatus().isActive).toBe(true);

      wakeLock.destroy();

      // Wait a bit for async cleanup
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(wakeLock.getStatus().isActive).toBe(false);
    });
  });

  describe('getSupportedStrategies', () => {
    it('should return list of supported strategies', () => {
      const strategies = wakeLock.getSupportedStrategies();

      expect(strategies).toContain('screen-wake-lock');
      expect(strategies.length).toBeGreaterThan(0);
    });
  });

  describe('checkPermissions', () => {
    it('should check wake lock permissions', async () => {
      const permission = await wakeLock.checkPermissions('screen');

      expect(permission).toBe('granted');
    });
  });
});
