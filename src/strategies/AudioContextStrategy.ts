import {
  FallbackStrategy,
  WakeLockType,
  WakeLockSentinel,
  RequestOptions,
  WakeLockError,
  WakeLockErrorCode,
  InternalWakeLockSentinel,
} from '../types';
import { isSSR, generateUniqueId, withTimeout } from '../utils/helpers';

export class AudioContextStrategy implements FallbackStrategy {
  public readonly name = 'audio-context';
  public readonly priority = 3;

  private activeContexts = new Map<
    string,
    {
      context: AudioContext;
      oscillator: OscillatorNode;
      gainNode: GainNode;
      sentinel: InternalWakeLockSentinel;
    }
  >();

  public isSupported(): boolean {
    if (isSSR()) return false;

    try {
      // Check if AudioContext is available
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      return typeof AudioContextClass === 'function';
    } catch {
      return false;
    }
  }

  public async request(
    type: WakeLockType,
    options: RequestOptions = {}
  ): Promise<WakeLockSentinel> {
    if (!this.isSupported()) {
      throw new WakeLockError(
        'Audio context strategy is not supported',
        WakeLockErrorCode.NOT_SUPPORTED,
        this.name
      );
    }

    if (type === 'system') {
      throw new WakeLockError(
        'System wake locks are not supported by audio context strategy',
        WakeLockErrorCode.NOT_SUPPORTED,
        this.name
      );
    }

    try {
      const timeout = options.timeout ?? 10000; // 10 second timeout
      const setupPromise = this.setupAudioContext();

      const { context, oscillator, gainNode, sentinelId } =
        timeout > 0 ? await withTimeout(setupPromise, timeout, options.signal) : await setupPromise;

      const sentinel = this.createSentinel(sentinelId, type);
      this.activeContexts.set(sentinelId, { context, oscillator, gainNode, sentinel });

      return sentinel;
    } catch (error) {
      throw new WakeLockError(
        `Audio context wake lock failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error && error.message.includes('timeout')
          ? WakeLockErrorCode.TIMEOUT
          : WakeLockErrorCode.STRATEGY_FAILED,
        this.name,
        error instanceof Error ? error : undefined
      );
    }
  }

  public async release(): Promise<void> {
    const releasePromises = Array.from(this.activeContexts.entries()).map(([id, audio]) => {
      return this.releaseSentinel(id, audio).catch(error => {
        console.warn(`Failed to release audio context ${id}:`, error);
      });
    });

    await Promise.allSettled(releasePromises);
    this.activeContexts.clear();
  }

  private async setupAudioContext(): Promise<{
    context: AudioContext;
    oscillator: OscillatorNode;
    gainNode: GainNode;
    sentinelId: string;
  }> {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const context = new AudioContextClass();
    const sentinelId = generateUniqueId();

    try {
      // Resume context if it's suspended (required by some browsers)
      if (context.state === 'suspended') {
        await context.resume();
      }

      // Create an oscillator that generates inaudible sound
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();

      // Configure for inaudible sound (very low volume, high frequency)
      oscillator.frequency.setValueAtTime(20000, context.currentTime); // 20kHz - above human hearing
      gainNode.gain.setValueAtTime(0.0001, context.currentTime); // Very low volume

      // Connect the audio graph
      oscillator.connect(gainNode);
      gainNode.connect(context.destination);

      // Start the oscillator
      oscillator.start();

      // Verify the context is running
      await new Promise<void>((resolve, reject) => {
        const startTime = Date.now();
        const checkRunning = (): void => {
          if (context.state === 'running') {
            resolve();
          } else if (Date.now() - startTime > 5000) {
            reject(new Error('Audio context failed to start'));
          } else {
            setTimeout(checkRunning, 100);
          }
        };
        checkRunning();
      });

      return { context, oscillator, gainNode, sentinelId };
    } catch (error) {
      // Clean up on error
      try {
        await context.close();
      } catch {
        // Ignore cleanup errors
      }
      throw error;
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

        const audio = (this._strategy as AudioContextStrategy).activeContexts.get(sentinelId);
        if (audio) {
          await (this._strategy as AudioContextStrategy).releaseSentinel(sentinelId, audio);
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

    return sentinel;
  }

  private async releaseSentinel(
    sentinelId: string,
    audio: {
      context: AudioContext;
      oscillator: OscillatorNode;
      gainNode: GainNode;
      sentinel: InternalWakeLockSentinel;
    }
  ): Promise<void> {
    if (audio.sentinel._released) return;

    try {
      // Stop the oscillator
      if (audio.oscillator) {
        try {
          audio.oscillator.stop();
        } catch {
          // Oscillator might already be stopped
        }
      }

      // Disconnect audio nodes
      if (audio.gainNode) {
        try {
          audio.gainNode.disconnect();
        } catch {
          // Node might already be disconnected
        }
      }

      // Close the audio context
      if (audio.context && audio.context.state !== 'closed') {
        await audio.context.close();
      }
    } catch (error) {
      console.warn('Error cleaning up audio context:', error);
    } finally {
      audio.sentinel._released = true;
      this.activeContexts.delete(sentinelId);

      // Notify release listeners
      for (const listener of audio.sentinel._releaseListeners) {
        try {
          listener();
        } catch (error) {
          console.error('Error in release listener:', error);
        }
      }
      audio.sentinel._releaseListeners.clear();
    }
  }

  public getActiveContextsCount(): number {
    return this.activeContexts.size;
  }

  public async suspendAll(): Promise<void> {
    const suspendPromises = Array.from(this.activeContexts.values()).map(async audio => {
      if (audio.context.state === 'running') {
        try {
          await audio.context.suspend();
        } catch (error) {
          console.warn('Failed to suspend audio context:', error);
        }
      }
    });

    await Promise.allSettled(suspendPromises);
  }

  public async resumeAll(): Promise<void> {
    const resumePromises = Array.from(this.activeContexts.values()).map(async audio => {
      if (audio.context.state === 'suspended') {
        try {
          await audio.context.resume();
        } catch (error) {
          console.warn('Failed to resume audio context:', error);
        }
      }
    });

    await Promise.allSettled(resumePromises);
  }
}
