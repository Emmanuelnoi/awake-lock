import { WakeLockType, WakeLockError, WakeLockErrorCode } from './types';
import { isSSR, isPermissionsSupported, checkPermission } from './utils/helpers';

export class PermissionManager {
  private readonly permissionCache = new Map<string, PermissionState>();
  private readonly cacheExpiryTime = 5 * 60 * 1000; // 5 minutes
  private readonly cacheTimestamps = new Map<string, number>();

  public async checkWakeLockPermission(
    type: WakeLockType,
    passive = false
  ): Promise<PermissionState | null> {
    if (isSSR()) return null;

    const cacheKey = `wake-lock-${type}`;
    const cached = this.getCachedPermission(cacheKey);
    if (cached) return cached;

    try {
      // Try to check wake-lock permission specifically
      const wakeLockPermission = await this.checkSpecificPermission('wake-lock' as PermissionName);
      if (wakeLockPermission) {
        this.setCachedPermission(cacheKey, wakeLockPermission);
        return wakeLockPermission;
      }

      // Fallback: check screen-wake-lock if available
      if (type === 'screen') {
        const screenPermission = await this.checkSpecificPermission(
          'screen-wake-lock' as PermissionName
        );
        if (screenPermission) {
          this.setCachedPermission(cacheKey, screenPermission);
          return screenPermission;
        }
      }

      // If no specific permission available and passive mode, assume granted
      if (passive) {
        this.setCachedPermission(cacheKey, 'granted');
        return 'granted';
      }

      return null;
    } catch (error) {
      if (passive) {
        // In passive mode, treat unknown permissions as potentially granted
        return null;
      }
      throw new WakeLockError(
        `Failed to check ${type} wake lock permission`,
        WakeLockErrorCode.PERMISSION_DENIED,
        'permission-manager',
        error instanceof Error ? error : undefined
      );
    }
  }

  public async requestWakeLockPermission(type: WakeLockType): Promise<PermissionState> {
    if (isSSR()) {
      throw new WakeLockError(
        'Wake lock not supported in server-side rendering',
        WakeLockErrorCode.NOT_SUPPORTED,
        'permission-manager'
      );
    }

    // Check if permission is already granted
    const currentPermission = await this.checkWakeLockPermission(type, true);
    if (currentPermission === 'granted') {
      return 'granted';
    }

    // Try to request permission through wake lock API
    try {
      if (
        'wakeLock' in navigator &&
        (
          navigator as Navigator & {
            wakeLock?: { request: (type: string) => Promise<{ release: () => Promise<void> }> };
          }
        ).wakeLock
      ) {
        // Attempt to request wake lock to trigger permission prompt
        const wakeLock = await (
          navigator as Navigator & {
            wakeLock: { request: (type: string) => Promise<{ release: () => Promise<void> }> };
          }
        ).wakeLock.request(type as 'screen');
        await wakeLock.release();

        // Update cache with granted permission
        const cacheKey = `wake-lock-${type}`;
        this.setCachedPermission(cacheKey, 'granted');
        return 'granted';
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          const cacheKey = `wake-lock-${type}`;
          this.setCachedPermission(cacheKey, 'denied');
          return 'denied';
        }

        throw new WakeLockError(
          `Failed to request ${type} wake lock permission: ${error.message}`,
          WakeLockErrorCode.PERMISSION_DENIED,
          'permission-manager',
          error
        );
      }
    }

    throw new WakeLockError(
      `Wake lock not supported for type: ${type}`,
      WakeLockErrorCode.NOT_SUPPORTED,
      'permission-manager'
    );
  }

  public async canRequestWithoutPrompt(type: WakeLockType): Promise<boolean> {
    if (isSSR()) return false;

    try {
      const permission = await this.checkWakeLockPermission(type, true);

      // If permission is already granted or denied, no prompt needed
      if (permission === 'granted' || permission === 'denied') {
        return true;
      }

      // If we can't determine permission state, assume prompt might be needed
      return false;
    } catch {
      return false;
    }
  }

  public isPassiveModeRecommended(): boolean {
    if (isSSR()) return true;

    // Recommend passive mode in scenarios where prompts are disruptive
    try {
      // Check if we're in an iframe
      if (window !== window.top) return true;

      // Check if document is not in focus
      if (document.visibilityState === 'hidden') return true;

      // Check if user hasn't interacted with the page recently
      if (!this.hasRecentUserInteraction()) return true;

      // Check for mobile devices (permission prompts are more disruptive)
      if (this.isMobileDevice()) return true;

      return false;
    } catch {
      return true;
    }
  }

  public clearPermissionCache(): void {
    this.permissionCache.clear();
    this.cacheTimestamps.clear();
  }

  private async checkSpecificPermission(name: PermissionName): Promise<PermissionState | null> {
    if (!isPermissionsSupported()) return null;

    try {
      return await checkPermission(name);
    } catch {
      return null;
    }
  }

  private getCachedPermission(key: string): PermissionState | null {
    const timestamp = this.cacheTimestamps.get(key);
    if (!timestamp || Date.now() - timestamp > this.cacheExpiryTime) {
      this.permissionCache.delete(key);
      this.cacheTimestamps.delete(key);
      return null;
    }

    return this.permissionCache.get(key) ?? null;
  }

  private setCachedPermission(key: string, permission: PermissionState): void {
    this.permissionCache.set(key, permission);
    this.cacheTimestamps.set(key, Date.now());
  }

  private hasRecentUserInteraction(): boolean {
    // Simple heuristic: check if there was recent user activity
    // This could be enhanced with actual interaction tracking
    return document.hasFocus() && Date.now() - this.getLastUserActivity() < 30000; // 30 seconds
  }

  private getLastUserActivity(): number {
    // This is a simplified implementation
    // In a real scenario, you'd track actual user interactions
    return Date.now() - 1000; // Assume recent activity for now
  }

  private isMobileDevice(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
  }
}
