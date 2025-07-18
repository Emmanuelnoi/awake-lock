// Type stubs for when Angular and RxJS are not available
declare module '@angular/core' {
  export interface OnDestroy {
    ngOnDestroy(): void;
  }
  export interface OnInit {
    ngOnInit(): void;
  }
  export class Injectable {
    constructor(config?: any);
  }
  export class NgZone {
    run<T>(fn: () => T): T;
    runOutsideAngular<T>(fn: () => T): T;
  }
  export class ElementRef<T = any> {
    nativeElement: T;
  }
  export class Input {
    constructor(bindingPropertyName?: string);
  }
  export class Directive {
    constructor(config?: any);
  }
  export class NgModule {
    constructor(config?: any);
  }
  export class InjectionToken<T> {
    constructor(desc: string);
  }
  export interface Provider {}
  export interface CanActivate {}
  export interface Resolve<T> {}
  export class Pipe {
    constructor(config?: any);
  }
  export interface PipeTransform {
    transform(value: any, ...args: any[]): any;
  }
}

declare module 'rxjs' {
  export class Observable<T> {
    pipe(...operators: any[]): Observable<T>;
    subscribe(observer?: any): any;
  }
  export class Subject<T> extends Observable<T> {
    next(value: T): void;
    error(err: any): void;
    complete(): void;
    asObservable(): Observable<T>;
  }
  export class BehaviorSubject<T> extends Subject<T> {
    constructor(value: T);
    asObservable(): Observable<T>;
  }
  export function fromEvent(target: any, eventName: string): Observable<any>;
  export function merge(...observables: Observable<any>[]): Observable<any>;
}

declare module 'rxjs/operators' {
  export function takeUntil<T>(notifier: Observable<any>): any;
  export function map<T, R>(fn: (value: T) => R): any;
  export function distinctUntilChanged<T>(): any;
  export function shareReplay<T>(bufferSize?: number): any;
}

import { Injectable, OnDestroy, NgZone } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { takeUntil, map, distinctUntilChanged, shareReplay } from 'rxjs/operators';

import { WakeLock } from '../WakeLock';
import {
  WakeLockOptions,
  WakeLockType,
  RequestOptions,
  WakeLockStatus,
  WakeLockSentinel,
  WakeLockEvents,
} from '../types';

@Injectable({
  providedIn: 'root',
})
export class WakeLockService implements OnDestroy {
  private wakeLock!: WakeLock;
  private readonly destroy$ = new Subject<void>();

  // State observables
  private readonly isActiveSubject = new BehaviorSubject<boolean>(false);
  private readonly statusSubject = new BehaviorSubject<WakeLockStatus>({
    isActive: false,
    type: null,
    strategy: null,
    startTime: null,
    batteryLevel: null,
    performanceMetrics: null,
  });
  private readonly errorSubject = new BehaviorSubject<Error | null>(null);
  private readonly isLoadingSubject = new BehaviorSubject<boolean>(false);

  // Event observables
  private readonly enabledSubject = new Subject<WakeLockEvents['enabled']>();
  private readonly disabledSubject = new Subject<WakeLockEvents['disabled']>();
  private readonly errorEventSubject = new Subject<WakeLockEvents['error']>();
  private readonly batteryChangeSubject = new Subject<WakeLockEvents['battery-change']>();
  private readonly performanceSubject = new Subject<WakeLockEvents['performance']>();
  private readonly fallbackSubject = new Subject<WakeLockEvents['fallback']>();
  private readonly visibilityChangeSubject = new Subject<WakeLockEvents['visibility-change']>();

  constructor(private ngZone: NgZone) {
    this.wakeLock = new WakeLock();
    this.setupEventListeners();
  }

  // Public observables
  public readonly isActive$ = this.isActiveSubject
    .asObservable()
    .pipe(distinctUntilChanged(), shareReplay(1));

  public readonly status$ = this.statusSubject
    .asObservable()
    .pipe(distinctUntilChanged(), shareReplay(1));

  public readonly error$ = this.errorSubject
    .asObservable()
    .pipe(distinctUntilChanged(), shareReplay(1));

  public readonly isLoading$ = this.isLoadingSubject
    .asObservable()
    .pipe(distinctUntilChanged(), shareReplay(1));

  // Event observables
  public readonly enabled$ = this.enabledSubject.asObservable();
  public readonly disabled$ = this.disabledSubject.asObservable();
  public readonly errorEvent$ = this.errorEventSubject.asObservable();
  public readonly batteryChange$ = this.batteryChangeSubject.asObservable();
  public readonly performance$ = this.performanceSubject.asObservable();
  public readonly fallback$ = this.fallbackSubject.asObservable();
  public readonly visibilityChange$ = this.visibilityChangeSubject.asObservable();

  // Derived observables
  public readonly isSupported$ = new BehaviorSubject<boolean>(this.wakeLock.isSupported());

  public async request(
    type: WakeLockType = 'screen',
    options: RequestOptions = {}
  ): Promise<WakeLockSentinel> {
    return this.ngZone.runOutsideAngular(async () => {
      this.isLoadingSubject.next(true);
      this.errorSubject.next(null);

      try {
        const sentinel = await this.wakeLock.request(type, options);
        this.ngZone.run(() => {
          this.isLoadingSubject.next(false);
        });
        return sentinel;
      } catch (error) {
        this.ngZone.run(() => {
          this.isLoadingSubject.next(false);
          const errorObj = error instanceof Error ? error : new Error('Unknown error');
          this.errorSubject.next(errorObj);
        });
        throw error;
      }
    });
  }

  public async release(): Promise<void> {
    return this.ngZone.runOutsideAngular(async () => {
      try {
        await this.wakeLock.release();
      } catch (error) {
        this.ngZone.run(() => {
          const errorObj =
            error instanceof Error ? error : new Error('Failed to release wake lock');
          this.errorSubject.next(errorObj);
        });
        throw error;
      }
    });
  }

  public isSupported(): boolean {
    return this.wakeLock.isSupported();
  }

  public getStatus(): WakeLockStatus {
    return this.wakeLock.getStatus();
  }

  public getSupportedStrategies(): string[] {
    return this.wakeLock.getSupportedStrategies();
  }

  public async checkPermissions(type: WakeLockType = 'screen'): Promise<PermissionState | null> {
    return await this.wakeLock.checkPermissions(type);
  }

  public ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.wakeLock.destroy();
  }

  private setupEventListeners(): void {
    this.wakeLock.on('enabled', event => {
      this.ngZone.run(() => {
        this.isActiveSubject.next(true);
        this.statusSubject.next(this.wakeLock.getStatus());
        this.errorSubject.next(null);
        this.enabledSubject.next(event);
      });
    });

    this.wakeLock.on('disabled', event => {
      this.ngZone.run(() => {
        this.isActiveSubject.next(false);
        this.statusSubject.next(this.wakeLock.getStatus());
        this.disabledSubject.next(event);
      });
    });

    this.wakeLock.on('error', event => {
      this.ngZone.run(() => {
        this.errorSubject.next(event.error);
        this.isLoadingSubject.next(false);
        this.errorEventSubject.next(event);
      });
    });

    this.wakeLock.on('battery-change', event => {
      this.ngZone.run(() => {
        this.statusSubject.next(this.wakeLock.getStatus());
        this.batteryChangeSubject.next(event);
      });
    });

    this.wakeLock.on('performance', event => {
      this.ngZone.run(() => {
        this.statusSubject.next(this.wakeLock.getStatus());
        this.performanceSubject.next(event);
      });
    });

    this.wakeLock.on('fallback', event => {
      this.ngZone.run(() => {
        this.fallbackSubject.next(event);
      });
    });

    this.wakeLock.on('visibility-change', event => {
      this.ngZone.run(() => {
        this.visibilityChangeSubject.next(event);
      });
    });
  }
}

// Angular directive for automatic wake lock management
@Directive({
  selector: '[wakeLock]',
})
export class WakeLockDirective implements OnInit, OnDestroy {
  @Input() wakeLock: WakeLockOptions = {};
  @Input() wakeLockType: WakeLockType = 'screen';
  @Input() wakeLockOptions: RequestOptions = {};
  @Input() wakeLockAutoRequest = false;

  private wakeLockInstance: WakeLock | null = null;
  private intersectionObserver: IntersectionObserver | null = null;

  constructor(
    private elementRef: ElementRef,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    this.wakeLockInstance = new WakeLock(this.wakeLock);

    if (this.wakeLockAutoRequest) {
      this.requestWakeLock();
    } else {
      this.setupIntersectionObserver();
    }
  }

  ngOnDestroy(): void {
    if (this.wakeLockInstance) {
      this.wakeLockInstance.destroy();
    }
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }
  }

  private requestWakeLock(): void {
    if (!this.wakeLockInstance) return;

    this.ngZone.runOutsideAngular(() => {
      this.wakeLockInstance!.request(this.wakeLockType, this.wakeLockOptions).catch(console.warn);
    });
  }

  private setupIntersectionObserver(): void {
    if (typeof IntersectionObserver === 'undefined') return;

    this.ngZone.runOutsideAngular(() => {
      this.intersectionObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            this.requestWakeLock();
          } else {
            this.wakeLockInstance?.release().catch(console.warn);
          }
        });
      });

      this.intersectionObserver.observe(this.elementRef.nativeElement);
    });
  }
}

// Angular module
@NgModule({
  declarations: [WakeLockDirective],
  providers: [WakeLockService],
  exports: [WakeLockDirective],
})
export class WakeLockModule {}

// Utility functions for Angular
export function createWakeLockFactory(options: WakeLockOptions = {}): () => WakeLock {
  return () => new WakeLock(options);
}

export const WAKE_LOCK_CONFIG = new InjectionToken<WakeLockOptions>('WAKE_LOCK_CONFIG');

export function provideWakeLock(options: WakeLockOptions = {}): Provider[] {
  return [
    { provide: WAKE_LOCK_CONFIG, useValue: options },
    {
      provide: WakeLock,
      useFactory: createWakeLockFactory(options),
      deps: [WAKE_LOCK_CONFIG],
    },
  ];
}

// Guard for route protection based on wake lock support
@Injectable({
  providedIn: 'root',
})
export class WakeLockGuard implements CanActivate {
  constructor(private wakeLockService: WakeLockService) {}

  canActivate(): boolean {
    return this.wakeLockService.isSupported();
  }
}

// Resolver for pre-loading wake lock status
@Injectable({
  providedIn: 'root',
})
export class WakeLockResolver implements Resolve<WakeLockStatus> {
  constructor(private wakeLockService: WakeLockService) {}

  resolve(): WakeLockStatus {
    return this.wakeLockService.getStatus();
  }
}

// Pipe for formatting wake lock status
@Pipe({ name: 'wakeLockStatus' })
export class WakeLockStatusPipe implements PipeTransform {
  transform(status: WakeLockStatus): string {
    if (!status.isActive) return 'Inactive';
    return `Active (${status.strategy}) - ${status.type}`;
  }
}

// Re-export Angular types for convenience
export type { OnDestroy, OnInit, Provider, CanActivate, Resolve, PipeTransform };
