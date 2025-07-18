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

export class VideoElementStrategy implements FallbackStrategy {
  public readonly name = 'video-element';
  public readonly priority = 2;

  private activeElements = new Map<
    string,
    { video: HTMLVideoElement; sentinel: InternalWakeLockSentinel }
  >();
  private mediaSource: MediaSource | null = null;

  public isSupported(): boolean {
    if (isSSR()) return false;

    try {
      // Check if we can create video elements and media sources
      const video = document.createElement('video');
      const canPlayType = video.canPlayType('video/mp4');
      const hasMediaSource = 'MediaSource' in window;

      return canPlayType !== '' && hasMediaSource;
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
        'Video element strategy is not supported',
        WakeLockErrorCode.NOT_SUPPORTED,
        this.name
      );
    }

    if (type === 'system') {
      throw new WakeLockError(
        'System wake locks are not supported by video element strategy',
        WakeLockErrorCode.NOT_SUPPORTED,
        this.name
      );
    }

    try {
      const timeout = options.timeout ?? 15000; // 15 second timeout for video setup
      const setupPromise = this.setupVideoElement();

      const { video, sentinelId } =
        timeout > 0 ? await withTimeout(setupPromise, timeout, options.signal) : await setupPromise;

      const sentinel = this.createSentinel(sentinelId, type);
      this.activeElements.set(sentinelId, { video, sentinel });

      return sentinel;
    } catch (error) {
      throw new WakeLockError(
        `Video element wake lock failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error && error.message.includes('timeout')
          ? WakeLockErrorCode.TIMEOUT
          : WakeLockErrorCode.STRATEGY_FAILED,
        this.name,
        error instanceof Error ? error : undefined
      );
    }
  }

  public async release(): Promise<void> {
    const releasePromises = Array.from(this.activeElements.entries()).map(
      ([id, { video, sentinel }]) => {
        return this.releaseSentinel(id, video, sentinel).catch(error => {
          console.warn(`Failed to release video element ${id}:`, error);
        });
      }
    );

    await Promise.allSettled(releasePromises);
    this.activeElements.clear();
  }

  private async setupVideoElement(): Promise<{ video: HTMLVideoElement; sentinelId: string }> {
    const video = document.createElement('video');
    const sentinelId = generateUniqueId();

    // Configure video element for wake lock behavior
    video.style.position = 'fixed';
    video.style.top = '-1000px';
    video.style.left = '-1000px';
    video.style.width = '1px';
    video.style.height = '1px';
    video.style.opacity = '0.01'; // Nearly invisible but not completely
    video.style.pointerEvents = 'none';
    video.style.zIndex = '-1000';

    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.controls = false;
    video.setAttribute('webkit-playsinline', 'true');
    video.setAttribute('playsinline', 'true');

    // Create a minimal video source
    const mediaSource = await this.createMediaSource();
    video.src = URL.createObjectURL(mediaSource);

    // Add to DOM (required for some browsers)
    document.body.appendChild(video);

    // Wait for video to be ready and start playing
    await new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Video setup timeout'));
      }, 10000);

      const cleanup = (): void => {
        clearTimeout(timeoutId);
        video.removeEventListener('canplay', onCanPlay);
        video.removeEventListener('error', onError);
      };

      const onCanPlay = (): void => {
        cleanup();
        video
          .play()
          .then(() => resolve())
          .catch(reject);
      };

      const onError = (): void => {
        cleanup();
        reject(new Error('Video failed to load'));
      };

      video.addEventListener('canplay', onCanPlay);
      video.addEventListener('error', onError);

      // Start loading
      video.load();
    });

    return { video, sentinelId };
  }

  private async createMediaSource(): Promise<MediaSource> {
    if (this.mediaSource && this.mediaSource.readyState === 'open') {
      return this.mediaSource;
    }

    const mediaSource = new MediaSource();

    return new Promise((resolve, reject) => {
      const onSourceOpen = (): void => {
        try {
          // Create a source buffer for a minimal video stream
          const sourceBuffer = mediaSource.addSourceBuffer('video/mp4; codecs="avc1.42E01E"');

          // Add minimal video data (1x1 pixel, 1 frame)
          const videoData = this.createMinimalVideoData();
          sourceBuffer.appendBuffer(videoData);

          sourceBuffer.addEventListener('updateend', () => {
            try {
              mediaSource.endOfStream();
              resolve(mediaSource);
            } catch (error) {
              reject(error);
            }
          });
        } catch (error) {
          reject(error);
        }
      };

      mediaSource.addEventListener('sourceopen', onSourceOpen);
    });
  }

  private createMinimalVideoData(): ArrayBuffer {
    // This is a minimal MP4 file with a single 1x1 black frame
    // In a real implementation, you might want to use a library to generate this
    const mp4Data = new Uint8Array([
      // Simplified MP4 structure - this is a placeholder
      // In production, you'd want to generate a proper minimal MP4
      0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0x00, 0x00, 0x02,
      0x00, 0x69, 0x73, 0x6f, 0x6d, 0x69, 0x73, 0x6f, 0x32, 0x61, 0x76, 0x63, 0x31, 0x6d, 0x70,
      0x34, 0x31,
    ]);

    return mp4Data.buffer;
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

        const element = (this._strategy as VideoElementStrategy).activeElements.get(sentinelId);
        if (element) {
          await (this._strategy as VideoElementStrategy).releaseSentinel(
            sentinelId,
            element.video,
            this
          );
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
    video: HTMLVideoElement,
    sentinel: InternalWakeLockSentinel
  ): Promise<void> {
    if (sentinel._released) return;

    try {
      // Stop video playback
      video.pause();
      video.src = '';
      video.load();

      // Remove from DOM
      if (video.parentNode) {
        video.parentNode.removeChild(video);
      }

      // Revoke object URL
      if (video.src.startsWith('blob:')) {
        URL.revokeObjectURL(video.src);
      }
    } catch (error) {
      console.warn('Error cleaning up video element:', error);
    } finally {
      sentinel._released = true;
      this.activeElements.delete(sentinelId);

      // Notify release listeners
      for (const listener of sentinel._releaseListeners) {
        try {
          listener();
        } catch (error) {
          console.error('Error in release listener:', error);
        }
      }
      sentinel._releaseListeners.clear();
    }
  }
}
