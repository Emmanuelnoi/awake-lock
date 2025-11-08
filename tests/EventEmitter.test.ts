import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventEmitter } from '../src/utils/EventEmitter';

interface TestEvents {
  test: { value: number };
  error: { message: string };
  ready: { timestamp: number };
  close: undefined;
}

describe('EventEmitter', () => {
  let emitter: EventEmitter<TestEvents>;

  beforeEach(() => {
    emitter = new EventEmitter<TestEvents>();
  });

  describe('addEventListener()', () => {
    it('should add event listener', () => {
      const listener = vi.fn();

      emitter.addEventListener('test', listener);

      expect(emitter.hasListeners('test')).toBe(true);
      expect(emitter.listenerCount('test')).toBe(1);
    });

    it('should add multiple listeners for same event', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      emitter.addEventListener('test', listener1);
      emitter.addEventListener('test', listener2);

      expect(emitter.listenerCount('test')).toBe(2);
    });

    it('should support once option as object', () => {
      const listener = vi.fn();

      emitter.addEventListener('test', listener, { once: true });

      expect(emitter.listenerCount('test')).toBe(1);

      emitter.dispatchEvent('test', { value: 42 });

      expect(listener).toHaveBeenCalledTimes(1);
      expect(emitter.listenerCount('test')).toBe(0);
    });

    it('should support once option as boolean', () => {
      const listener = vi.fn();

      emitter.addEventListener('test', listener, false);

      expect(emitter.listenerCount('test')).toBe(1);

      emitter.dispatchEvent('test', { value: 42 });

      expect(listener).toHaveBeenCalledTimes(1);
      expect(emitter.listenerCount('test')).toBe(1); // Still there
    });

    it('should allow same listener to be added multiple times', () => {
      const listener = vi.fn();

      emitter.addEventListener('test', listener);
      emitter.addEventListener('test', listener);

      // Set behavior - only stores unique references
      expect(emitter.listenerCount('test')).toBe(1);
    });
  });

  describe('removeEventListener()', () => {
    it('should remove event listener', () => {
      const listener = vi.fn();

      emitter.addEventListener('test', listener);
      expect(emitter.listenerCount('test')).toBe(1);

      emitter.removeEventListener('test', listener);
      expect(emitter.listenerCount('test')).toBe(0);
    });

    it('should remove specific listener while keeping others', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      emitter.addEventListener('test', listener1);
      emitter.addEventListener('test', listener2);

      emitter.removeEventListener('test', listener1);

      expect(emitter.listenerCount('test')).toBe(1);

      emitter.dispatchEvent('test', { value: 42 });
      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });

    it('should handle removing non-existent listener', () => {
      const listener = vi.fn();

      emitter.removeEventListener('test', listener);

      expect(emitter.listenerCount('test')).toBe(0);
    });

    it('should remove once listeners', () => {
      const listener = vi.fn();

      emitter.addEventListener('test', listener, { once: true });
      expect(emitter.listenerCount('test')).toBe(1);

      emitter.removeEventListener('test', listener);
      expect(emitter.listenerCount('test')).toBe(0);
    });
  });

  describe('dispatchEvent()', () => {
    it('should dispatch event to listener', () => {
      const listener = vi.fn();

      emitter.addEventListener('test', listener);
      emitter.dispatchEvent('test', { value: 42 });

      expect(listener).toHaveBeenCalledWith({ value: 42 });
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should dispatch event to multiple listeners', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      emitter.addEventListener('test', listener1);
      emitter.addEventListener('test', listener2);

      emitter.dispatchEvent('test', { value: 42 });

      expect(listener1).toHaveBeenCalledWith({ value: 42 });
      expect(listener2).toHaveBeenCalledWith({ value: 42 });
    });

    it('should return true after dispatching', () => {
      const listener = vi.fn();

      emitter.addEventListener('test', listener);
      const result = emitter.dispatchEvent('test', { value: 42 });

      expect(result).toBe(true);
    });

    it('should return true even when no listeners', () => {
      const result = emitter.dispatchEvent('test', { value: 42 });

      expect(result).toBe(true);
    });

    it('should handle errors in listeners', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const goodListener = vi.fn();
      const badListener = vi.fn(() => {
        throw new Error('Listener error');
      });

      emitter.addEventListener('test', badListener);
      emitter.addEventListener('test', goodListener);

      emitter.dispatchEvent('test', { value: 42 });

      expect(badListener).toHaveBeenCalled();
      expect(goodListener).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should call once listeners only once', () => {
      const listener = vi.fn();

      emitter.addEventListener('test', listener, { once: true });

      emitter.dispatchEvent('test', { value: 1 });
      emitter.dispatchEvent('test', { value: 2 });

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith({ value: 1 });
    });

    it('should call both regular and once listeners', () => {
      const regularListener = vi.fn();
      const onceListener = vi.fn();

      emitter.addEventListener('test', regularListener);
      emitter.addEventListener('test', onceListener, { once: true });

      emitter.dispatchEvent('test', { value: 1 });
      emitter.dispatchEvent('test', { value: 2 });

      expect(regularListener).toHaveBeenCalledTimes(2);
      expect(onceListener).toHaveBeenCalledTimes(1);
    });

    it('should clear once listeners after dispatch', () => {
      const listener = vi.fn();

      emitter.addEventListener('test', listener, { once: true });

      emitter.dispatchEvent('test', { value: 42 });

      expect(emitter.listenerCount('test')).toBe(0);
    });
  });

  describe('on() / off() aliases', () => {
    it('on() should add listener', () => {
      const listener = vi.fn();

      emitter.on('test', listener);

      emitter.emit('test', { value: 42 });

      expect(listener).toHaveBeenCalledWith({ value: 42 });
    });

    it('off() should remove listener', () => {
      const listener = vi.fn();

      emitter.on('test', listener);
      emitter.off('test', listener);

      emitter.emit('test', { value: 42 });

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('once()', () => {
    it('should add listener that fires only once', () => {
      const listener = vi.fn();

      emitter.once('test', listener);

      emitter.emit('test', { value: 1 });
      emitter.emit('test', { value: 2 });

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith({ value: 1 });
    });

    it('should allow removal before firing', () => {
      const listener = vi.fn();

      emitter.once('test', listener);
      emitter.off('test', listener);

      emitter.emit('test', { value: 42 });

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('emit()', () => {
    it('should dispatch event using emit alias', () => {
      const listener = vi.fn();

      emitter.on('test', listener);
      const result = emitter.emit('test', { value: 42 });

      expect(listener).toHaveBeenCalledWith({ value: 42 });
      expect(result).toBe(true);
    });
  });

  describe('listenerCount()', () => {
    it('should return 0 for event with no listeners', () => {
      expect(emitter.listenerCount('test')).toBe(0);
    });

    it('should return correct count for regular listeners', () => {
      emitter.on('test', vi.fn());
      emitter.on('test', vi.fn());

      expect(emitter.listenerCount('test')).toBe(2);
    });

    it('should include once listeners in count', () => {
      emitter.on('test', vi.fn());
      emitter.once('test', vi.fn());

      expect(emitter.listenerCount('test')).toBe(2);
    });

    it('should update count after dispatching once listeners', () => {
      emitter.once('test', vi.fn());

      expect(emitter.listenerCount('test')).toBe(1);

      emitter.emit('test', { value: 42 });

      expect(emitter.listenerCount('test')).toBe(0);
    });
  });

  describe('hasListeners()', () => {
    it('should return false for event with no listeners', () => {
      expect(emitter.hasListeners('test')).toBe(false);
    });

    it('should return true for event with listeners', () => {
      emitter.on('test', vi.fn());

      expect(emitter.hasListeners('test')).toBe(true);
    });

    it('should return false after removing all listeners', () => {
      const listener = vi.fn();

      emitter.on('test', listener);
      expect(emitter.hasListeners('test')).toBe(true);

      emitter.off('test', listener);
      expect(emitter.hasListeners('test')).toBe(false);
    });
  });

  describe('removeAllListeners()', () => {
    it('should remove all listeners for specific event', () => {
      emitter.on('test', vi.fn());
      emitter.on('test', vi.fn());
      emitter.once('test', vi.fn());

      expect(emitter.listenerCount('test')).toBe(3);

      emitter.removeAllListeners('test');

      expect(emitter.listenerCount('test')).toBe(0);
    });

    it('should remove all listeners for all events', () => {
      emitter.on('test', vi.fn());
      emitter.on('error', vi.fn());
      emitter.on('ready', vi.fn());

      expect(emitter.listenerCount('test')).toBeGreaterThan(0);
      expect(emitter.listenerCount('error')).toBeGreaterThan(0);
      expect(emitter.listenerCount('ready')).toBeGreaterThan(0);

      emitter.removeAllListeners();

      expect(emitter.listenerCount('test')).toBe(0);
      expect(emitter.listenerCount('error')).toBe(0);
      expect(emitter.listenerCount('ready')).toBe(0);
    });

    it('should keep other event listeners when removing specific event', () => {
      emitter.on('test', vi.fn());
      emitter.on('error', vi.fn());

      emitter.removeAllListeners('test');

      expect(emitter.listenerCount('test')).toBe(0);
      expect(emitter.listenerCount('error')).toBe(1);
    });
  });

  describe('eventNames()', () => {
    it('should return empty array when no listeners', () => {
      expect(emitter.eventNames()).toEqual([]);
    });

    it('should return array of event names with listeners', () => {
      emitter.on('test', vi.fn());
      emitter.on('error', vi.fn());

      const names = emitter.eventNames();

      expect(names).toContain('test');
      expect(names).toContain('error');
      expect(names).toHaveLength(2);
    });

    it('should include once listener event names', () => {
      emitter.once('test', vi.fn());

      const names = emitter.eventNames();

      expect(names).toContain('test');
    });

    it('should not duplicate event names', () => {
      emitter.on('test', vi.fn());
      emitter.on('test', vi.fn());
      emitter.once('test', vi.fn());

      const names = emitter.eventNames();

      expect(names.filter(name => name === 'test')).toHaveLength(1);
    });

    it('should update after removing all listeners', () => {
      emitter.on('test', vi.fn());
      emitter.on('error', vi.fn());

      emitter.removeAllListeners('test');

      const names = emitter.eventNames();

      expect(names).not.toContain('test');
      expect(names).toContain('error');
    });
  });

  describe('Memory Leaks', () => {
    it('should not leak memory with once listeners', () => {
      for (let i = 0; i < 1000; i++) {
        emitter.once('test', vi.fn());
        emitter.emit('test', { value: i });
      }

      expect(emitter.listenerCount('test')).toBe(0);
    });

    it('should not leak memory when removing listeners', () => {
      const listeners: Array<() => void> = [];

      for (let i = 0; i < 1000; i++) {
        const listener = vi.fn();
        listeners.push(listener);
        emitter.on('test', listener);
      }

      for (const listener of listeners) {
        emitter.off('test', listener);
      }

      expect(emitter.listenerCount('test')).toBe(0);
    });

    it('should clear listeners with removeAllListeners', () => {
      for (let i = 0; i < 1000; i++) {
        emitter.on('test', vi.fn());
      }

      emitter.removeAllListeners('test');

      expect(emitter.listenerCount('test')).toBe(0);
    });
  });

  describe('Type Safety', () => {
    it('should work with different event payload types', () => {
      emitter.on('test', (event) => {
        expect(event.value).toBe(42);
      });

      emitter.on('error', (event) => {
        expect(event.message).toBe('test error');
      });

      emitter.on('ready', (event) => {
        expect(event.timestamp).toBeGreaterThan(0);
      });

      emitter.on('close', (event) => {
        expect(event).toBeUndefined();
      });

      emitter.emit('test', { value: 42 });
      emitter.emit('error', { message: 'test error' });
      emitter.emit('ready', { timestamp: Date.now() });
      emitter.emit('close', undefined);
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid add/remove cycles', () => {
      const listener = vi.fn();

      for (let i = 0; i < 100; i++) {
        emitter.on('test', listener);
        emitter.off('test', listener);
      }

      expect(emitter.listenerCount('test')).toBe(0);
    });

    it('should handle concurrent dispatches', () => {
      const listener = vi.fn();
      emitter.on('test', listener);

      emitter.emit('test', { value: 1 });
      emitter.emit('test', { value: 2 });
      emitter.emit('test', { value: 3 });

      expect(listener).toHaveBeenCalledTimes(3);
    });

    it('should handle listener adding another listener during dispatch', () => {
      const listener2 = vi.fn();
      const listener1 = vi.fn(() => {
        emitter.on('test', listener2);
      });

      emitter.on('test', listener1);
      emitter.emit('test', { value: 1 });

      expect(listener1).toHaveBeenCalledTimes(1);
      // Note: listener2 might be called in same dispatch if implementation iterates over current Set
      // This is implementation-specific behavior

      emitter.emit('test', { value: 2 });

      // listener2 should definitely be called on second emit
      expect(listener2).toHaveBeenCalled();
    });

    it('should handle listener removing itself during dispatch', () => {
      const listener = vi.fn(function(this: typeof emitter) {
        this.off('test', listener);
      }.bind(emitter));

      emitter.on('test', listener);

      emitter.emit('test', { value: 1 });
      emitter.emit('test', { value: 2 });

      expect(listener).toHaveBeenCalledTimes(1);
    });
  });
});
