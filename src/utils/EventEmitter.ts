import { EventListener, TypedEventTarget } from '../types';

export class EventEmitter<T extends Record<string, unknown> = Record<string, unknown>>
  implements TypedEventTarget<T>
{
  private readonly listeners = new Map<keyof T, Set<EventListener<T[keyof T]>>>();
  private readonly onceListeners = new Map<keyof T, Set<EventListener<T[keyof T]>>>();

  public addEventListener<K extends keyof T>(
    type: K,
    listener: EventListener<T[K]>,
    options?: boolean | AddEventListenerOptions
  ): void {
    const once = typeof options === 'object' ? options.once : false;
    const listenerMap = once ? this.onceListeners : this.listeners;

    if (!listenerMap.has(type)) {
      listenerMap.set(type, new Set());
    }

    listenerMap.get(type)!.add(listener as EventListener<T[keyof T]>);
  }

  public removeEventListener<K extends keyof T>(
    type: K,
    listener: EventListener<T[K]>,
    _options?: boolean | EventListenerOptions
  ): void {
    this.listeners.get(type)?.delete(listener as EventListener<T[keyof T]>);
    this.onceListeners.get(type)?.delete(listener as EventListener<T[keyof T]>);
  }

  public dispatchEvent<K extends keyof T>(type: K, event: T[K]): boolean {
    const regularListeners = this.listeners.get(type);
    const onceListeners = this.onceListeners.get(type);

    if (regularListeners) {
      for (const listener of regularListeners) {
        try {
          listener(event);
        } catch (error) {
          console.error(`Error in event listener for '${String(type)}':`, error);
        }
      }
    }

    if (onceListeners) {
      for (const listener of onceListeners) {
        try {
          listener(event);
        } catch (error) {
          console.error(`Error in event listener for '${String(type)}':`, error);
        }
      }
      this.onceListeners.delete(type);
    }

    return true;
  }

  public on<K extends keyof T>(type: K, listener: EventListener<T[K]>): void {
    this.addEventListener(type, listener);
  }

  public off<K extends keyof T>(type: K, listener: EventListener<T[K]>): void {
    this.removeEventListener(type, listener);
  }

  public once<K extends keyof T>(type: K, listener: EventListener<T[K]>): void {
    this.addEventListener(type, listener, { once: true });
  }

  public emit<K extends keyof T>(type: K, event: T[K]): boolean {
    return this.dispatchEvent(type, event);
  }

  public listenerCount<K extends keyof T>(type: K): number {
    const regular = this.listeners.get(type)?.size ?? 0;
    const once = this.onceListeners.get(type)?.size ?? 0;
    return regular + once;
  }

  public hasListeners<K extends keyof T>(type: K): boolean {
    return this.listenerCount(type) > 0;
  }

  public removeAllListeners<K extends keyof T>(type?: K): void {
    if (type !== undefined) {
      this.listeners.delete(type);
      this.onceListeners.delete(type);
    } else {
      this.listeners.clear();
      this.onceListeners.clear();
    }
  }

  public eventNames(): Array<keyof T> {
    const names = new Set<keyof T>();

    for (const name of this.listeners.keys()) {
      names.add(name);
    }

    for (const name of this.onceListeners.keys()) {
      names.add(name);
    }

    return Array.from(names);
  }
}
