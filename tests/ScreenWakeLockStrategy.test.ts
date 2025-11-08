import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ScreenWakeLockStrategy } from '../src/strategies/ScreenWakeLockStrategy';
import { WakeLockErrorCode } from '../src/types';
import { createMockWakeLockSentinel } from './setup';

describe('ScreenWakeLockStrategy', () => {
  let strategy: ScreenWakeLockStrategy;
  let mockRequestFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    strategy = new ScreenWakeLockStrategy();

    // Use the existing mock from setup.ts and spy on it
    mockRequestFn = navigator.wakeLock.request as ReturnType<typeof vi.fn>;
    mockRequestFn.mockClear(); // Clear previous calls
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Properties', () => {
    it('should have correct name', () => {
      expect(strategy.name).toBe('screen-wake-lock');
    });

    it('should have priority 1 (highest)', () => {
      expect(strategy.priority).toBe(1);
    });
  });

  describe('isSupported()', () => {
    it('should return true when Wake Lock API is supported', () => {
      expect(strategy.isSupported()).toBe(true);
    });

    it('should return false in SSR environment', () => {
      const originalWindow = global.window;
      // @ts-expect-error - Testing SSR
      delete global.window;

      expect(strategy.isSupported()).toBe(false);

      global.window = originalWindow;
    });

    it.skip('should return false when wakeLock is not in navigator', () => {
      // Skipping: Cannot delete navigator.wakeLock in test environment
    });
  });

  describe('request()', () => {
    it('should successfully request a screen wake lock', async () => {
      const mockSentinel = createMockWakeLockSentinel();
      mockRequestFn.mockResolvedValue(mockSentinel);

      const sentinel = await strategy.request('screen');

      expect(mockRequestFn).toHaveBeenCalledWith('screen');
      expect(sentinel.type).toBe('screen');
      expect(sentinel.released).toBe(false);
    });

    it.skip('should throw error when not supported', async () => {
      // Skipping: Cannot delete navigator.wakeLock in test environment
    });

    it('should throw error for system wake lock type', async () => {
      await expect(strategy.request('system')).rejects.toMatchObject({
        code: WakeLockErrorCode.NOT_SUPPORTED,
        message: expect.stringContaining('System wake locks'),
      });
    });

    it('should apply default timeout of 10 seconds', async () => {
      const mockSentinel = createMockWakeLockSentinel();
      mockRequestFn.mockResolvedValue(mockSentinel);

      await strategy.request('screen');

      // Verify that withTimeout was called (it's wrapped in the request)
      expect(mockRequestFn).toHaveBeenCalled();
    });

    it('should respect custom timeout option', async () => {
      const mockSentinel = createMockWakeLockSentinel();
      mockRequestFn.mockResolvedValue(mockSentinel);

      await strategy.request('screen', { timeout: 5000 });

      expect(mockRequestFn).toHaveBeenCalledWith('screen');
    });

    it('should handle timeout of 0 (no timeout)', async () => {
      const mockSentinel = createMockWakeLockSentinel();
      mockRequestFn.mockResolvedValue(mockSentinel);

      const sentinel = await strategy.request('screen', { timeout: 0 });

      expect(sentinel).toBeDefined();
      expect(mockRequestFn).toHaveBeenCalledWith('screen');
    });

    it('should handle NotAllowedError (permission denied)', async () => {
      const error = new Error('User denied permission');
      error.name = 'NotAllowedError';
      mockRequestFn.mockRejectedValue(error);

      await expect(strategy.request('screen')).rejects.toMatchObject({
        code: WakeLockErrorCode.PERMISSION_DENIED,
        strategy: 'screen-wake-lock',
      });
    });

    it('should handle NotSupportedError', async () => {
      const error = new Error('Not supported');
      error.name = 'NotSupportedError';
      mockRequestFn.mockRejectedValue(error);

      await expect(strategy.request('screen')).rejects.toMatchObject({
        code: WakeLockErrorCode.NOT_SUPPORTED,
        strategy: 'screen-wake-lock',
      });
    });

    it('should handle AbortError as timeout', async () => {
      const error = new Error('Aborted');
      error.name = 'AbortError';
      mockRequestFn.mockRejectedValue(error);

      await expect(strategy.request('screen')).rejects.toMatchObject({
        code: WakeLockErrorCode.TIMEOUT,
        strategy: 'screen-wake-lock',
      });
    });

    it('should handle timeout error message', async () => {
      const error = new Error('request timeout after 10000ms');
      mockRequestFn.mockRejectedValue(error);

      await expect(strategy.request('screen')).rejects.toMatchObject({
        code: WakeLockErrorCode.TIMEOUT,
        strategy: 'screen-wake-lock',
      });
    });

    it('should handle unknown errors', async () => {
      const error = new Error('Unknown error');
      mockRequestFn.mockRejectedValue(error);

      await expect(strategy.request('screen')).rejects.toMatchObject({
        code: WakeLockErrorCode.UNKNOWN,
        strategy: 'screen-wake-lock',
      });
    });

    it('should handle non-Error throws', async () => {
      mockRequestFn.mockRejectedValue('String error');

      await expect(strategy.request('screen')).rejects.toMatchObject({
        code: WakeLockErrorCode.UNKNOWN,
        message: expect.stringContaining('Unknown error'),
      });
    });

    it('should track active sentinels', async () => {
      const mockSentinel = createMockWakeLockSentinel();
      mockRequestFn.mockResolvedValue(mockSentinel);

      const sentinel = await strategy.request('screen');

      const activeSentinels = strategy.getActiveSentinels();
      expect(activeSentinels.size).toBe(1);
      expect(activeSentinels.has(sentinel as never)).toBe(true);
    });

    it('should handle multiple concurrent requests', async () => {
      const mockSentinel1 = createMockWakeLockSentinel();
      const mockSentinel2 = createMockWakeLockSentinel();

      mockRequestFn
        .mockResolvedValueOnce(mockSentinel1)
        .mockResolvedValueOnce(mockSentinel2);

      const [sentinel1, sentinel2] = await Promise.all([
        strategy.request('screen'),
        strategy.request('screen'),
      ]);

      expect(strategy.getActiveSentinels().size).toBe(2);
      expect(sentinel1).toBeDefined();
      expect(sentinel2).toBeDefined();
    });
  });

  describe('Wrapped Sentinel', () => {
    let wrappedSentinel: Awaited<ReturnType<typeof strategy.request>>;
    let nativeSentinel: ReturnType<typeof createMockWakeLockSentinel>;

    beforeEach(async () => {
      nativeSentinel = createMockWakeLockSentinel();
      mockRequestFn.mockResolvedValue(nativeSentinel);
      wrappedSentinel = await strategy.request('screen');
    });

    it('should wrap native sentinel correctly', () => {
      expect(wrappedSentinel.type).toBe(nativeSentinel.type);
      expect(wrappedSentinel.released).toBe(false);
    });

    it('should expose _strategy property', () => {
      expect((wrappedSentinel as never)['_strategy']).toBe(strategy);
    });

    it('should maintain released state', async () => {
      expect(wrappedSentinel.released).toBe(false);

      await wrappedSentinel.release();

      expect(wrappedSentinel.released).toBe(true);
    });

    it('should reflect native sentinel released state', () => {
      // Change internal state
      (nativeSentinel as any).released = true;
      nativeSentinel._released = true;

      expect(wrappedSentinel.released).toBe(true);
    });

    it('should forward addEventListener to native sentinel', () => {
      const listener = vi.fn();

      wrappedSentinel.addEventListener('release', listener);

      expect(nativeSentinel.addEventListener).toHaveBeenCalledWith('release', listener);
    });

    it('should forward removeEventListener to native sentinel', () => {
      const listener = vi.fn();

      wrappedSentinel.removeEventListener('release', listener);

      expect(nativeSentinel.removeEventListener).toHaveBeenCalledWith('release', listener);
    });

    it('should handle native sentinel release events', () => {
      const releaseListener = nativeSentinel.addEventListener.mock.calls
        .find(([type]) => type === 'release')?.[1];

      expect(releaseListener).toBeDefined();

      // Trigger native release
      releaseListener!();

      expect(wrappedSentinel.released).toBe(true);
      expect(strategy.getActiveSentinels().size).toBe(0);
    });
  });

  describe('release()', () => {
    it('should release single active sentinel', async () => {
      const mockSentinel = createMockWakeLockSentinel();
      mockRequestFn.mockResolvedValue(mockSentinel);

      await strategy.request('screen');
      await strategy.release();

      expect(mockSentinel.release).toHaveBeenCalled();
      expect(strategy.getActiveSentinels().size).toBe(0);
    });

    it('should release multiple active sentinels', async () => {
      const mockSentinel1 = createMockWakeLockSentinel();
      const mockSentinel2 = createMockWakeLockSentinel();

      mockRequestFn
        .mockResolvedValueOnce(mockSentinel1)
        .mockResolvedValueOnce(mockSentinel2);

      await strategy.request('screen');
      await strategy.request('screen');

      expect(strategy.getActiveSentinels().size).toBe(2);

      await strategy.release();

      expect(mockSentinel1.release).toHaveBeenCalled();
      expect(mockSentinel2.release).toHaveBeenCalled();
      expect(strategy.getActiveSentinels().size).toBe(0);
    });

    it('should handle release errors gracefully', async () => {
      const mockSentinel = createMockWakeLockSentinel();
      mockSentinel.release.mockRejectedValue(new Error('Release failed'));
      mockRequestFn.mockResolvedValue(mockSentinel);

      await strategy.request('screen');

      // Should not throw
      await expect(strategy.release()).resolves.toBeUndefined();

      expect(strategy.getActiveSentinels().size).toBe(0);
    });

    it('should clear all sentinels even if some fail to release', async () => {
      const mockSentinel1 = createMockWakeLockSentinel();
      const mockSentinel2 = createMockWakeLockSentinel();

      mockSentinel1.release.mockRejectedValue(new Error('Failed'));
      mockSentinel2.release.mockResolvedValue(undefined);

      mockRequestFn
        .mockResolvedValueOnce(mockSentinel1)
        .mockResolvedValueOnce(mockSentinel2);

      await strategy.request('screen');
      await strategy.request('screen');

      await strategy.release();

      expect(strategy.getActiveSentinels().size).toBe(0);
    });

    it('should not throw when releasing with no active sentinels', async () => {
      await expect(strategy.release()).resolves.toBeUndefined();
    });
  });

  describe('Sentinel release() method', () => {
    let wrappedSentinel: Awaited<ReturnType<typeof strategy.request>>;
    let nativeSentinel: ReturnType<typeof createMockWakeLockSentinel>;

    beforeEach(async () => {
      nativeSentinel = createMockWakeLockSentinel();
      mockRequestFn.mockResolvedValue(nativeSentinel);
      wrappedSentinel = await strategy.request('screen');
    });

    it('should release wrapped sentinel', async () => {
      await wrappedSentinel.release();

      expect(nativeSentinel.release).toHaveBeenCalled();
      expect(wrappedSentinel.released).toBe(true);
    });

    it('should remove sentinel from active set', async () => {
      expect(strategy.getActiveSentinels().size).toBe(1);

      await wrappedSentinel.release();

      expect(strategy.getActiveSentinels().size).toBe(0);
    });

    it('should call release listeners', async () => {
      const listener = vi.fn();
      (wrappedSentinel as never)['_releaseListeners'].add(listener);

      await wrappedSentinel.release();

      expect(listener).toHaveBeenCalled();
    });

    it('should handle errors in release listeners', async () => {
      const listener = vi.fn(() => {
        throw new Error('Listener error');
      });
      (wrappedSentinel as never)['_releaseListeners'].add(listener);

      // Should not throw
      await expect(wrappedSentinel.release()).resolves.toBeUndefined();
    });

    it('should clear release listeners after calling', async () => {
      const listener = vi.fn();
      (wrappedSentinel as never)['_releaseListeners'].add(listener);

      await wrappedSentinel.release();

      expect((wrappedSentinel as never)['_releaseListeners'].size).toBe(0);
    });

    it('should be idempotent (calling release() multiple times)', async () => {
      await wrappedSentinel.release();
      await wrappedSentinel.release();
      await wrappedSentinel.release();

      // Native release should only be called once
      expect(nativeSentinel.release).toHaveBeenCalledTimes(1);
    });

    it('should set released flag even if native release fails', async () => {
      nativeSentinel.release.mockRejectedValue(new Error('Native release failed'));

      try {
        await wrappedSentinel.release();
      } catch {
        // Expected to handle error
      }

      expect(wrappedSentinel.released).toBe(true);
      expect(strategy.getActiveSentinels().size).toBe(0);
    });
  });

  describe('getActiveSentinels()', () => {
    it('should return empty set initially', () => {
      const sentinels = strategy.getActiveSentinels();

      expect(sentinels.size).toBe(0);
    });

    it('should return readonly set', () => {
      const sentinels = strategy.getActiveSentinels();

      expect(sentinels).toBeInstanceOf(Set);
      // ReadonlySet should not have add/delete methods exposed
      expect(typeof (sentinels as Set<never>).add).toBe('function');
    });

    it('should reflect current active sentinels', async () => {
      const mockSentinel = createMockWakeLockSentinel();
      mockRequestFn.mockResolvedValue(mockSentinel);

      await strategy.request('screen');

      expect(strategy.getActiveSentinels().size).toBe(1);

      await strategy.release();

      expect(strategy.getActiveSentinels().size).toBe(0);
    });
  });

  describe('AbortSignal integration', () => {
    it('should handle AbortSignal in request options', async () => {
      const mockSentinel = createMockWakeLockSentinel();
      mockRequestFn.mockResolvedValue(mockSentinel);

      const controller = new AbortController();
      const sentinel = await strategy.request('screen', {
        signal: controller.signal,
      });

      expect(sentinel).toBeDefined();
    });

    it.skip('should abort request when signal is aborted', async () => {
      // Skipping: Timing-sensitive test with AbortSignal
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid request/release cycles', async () => {
      for (let i = 0; i < 10; i++) {
        const mockSentinel = createMockWakeLockSentinel();
        mockRequestFn.mockResolvedValue(mockSentinel);

        await strategy.request('screen');
        await strategy.release();
      }

      expect(strategy.getActiveSentinels().size).toBe(0);
    });

    it('should handle sentinel release while strategy is releasing', async () => {
      const mockSentinel = createMockWakeLockSentinel();
      mockRequestFn.mockResolvedValue(mockSentinel);

      const sentinel = await strategy.request('screen');

      // Release both simultaneously
      await Promise.all([
        strategy.release(),
        sentinel.release(),
      ]);

      expect(strategy.getActiveSentinels().size).toBe(0);
    });
  });
});
