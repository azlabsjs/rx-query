import { QueryArguments, UnknownType, CacheQueryConfig, Logger } from './types';

// @internal
export type TypeDef = {
  id?: string | number;
  argument: unknown;
};

/**
 * @internal internal caching implementation of queries.
 *
 */
export class Cache<T extends object = object> {
  /**
   * @internal state of the cache instance
   */
  private _state: T[] = [];
  get length() {
    return this._state.length;
  }

  // queries cache constructor
  constructor(private logger?: Logger) {}

  /**
   * removes all items from the cache system
   */
  clear() {
    this.logger?.log(`Flushing cache...`);
    for (const item of this._state ?? []) {
      if ('destroy' in item && typeof item.destroy === 'function') {
        item.destroy();
      }
    }
    this._state = [];
  }

  /**
   * add an item to the cache
   */
  add(item: T): void {
    this.logger?.log(`Pushing into cache: `, item);
    this._state = [item, ...(this._state ?? [])];
    this.logger?.log(`Pushed into cache: `, this._state);
  }

  /**
   * checks if the cache contains a specific key
   */
  has(argument: T | ((items: T) => boolean)) {
    if (typeof argument === 'function') {
      return !!this._state.find(argument);
    }
    return this.indexOf(argument) !== -1;
  }

  /**
   * return the element in the cache matching the provided argument
   */
  get(argument: T | ((items: T) => boolean)) {
    if (typeof argument === 'function') {
      return this._state.find(argument);
    }
    return this.at(this.indexOf(argument));
  }

  /**
   * cache is empty if all element has been removed from the cache
   */
  isEmpty() {
    return this.length === 0;
  }

  /**
   * deletes an item from the cache
   */
  remove(argument: T | ((items: T) => boolean)) {
    let value: T | undefined;

    if (typeof argument === 'function') {
      value = this._state.find(argument);
    } else {
      value = argument;
    }

    if (value) {
      this.removeAt(this.indexOf(value));
    }
  }

  private at(index: number) {
    return index === -1 || index > this._state.length - 1
      ? undefined
      : this._state[index];
  }

  private removeAt(index: number) {
    const items = [...this._state];
    const values = items.splice(index, 1);
    // When removing element from cache we call destroy method
    // in order to unsubscribe to any observable being run internally
    for (const value of values) {
      if (value && 'destroy' in value && typeof value.destroy === 'function') {
        value.destroy();
      }
    }
    this._state = items;
  }

  private indexOf(argument: T) {
    return this._state.findIndex((q) => q === argument);
  }

  prune() {
    for (const value of this._state) {
      if (
        value &&
        'expired' in value &&
        typeof value.expired === 'function' &&
        value.expired()
      ) {
        if (
          value &&
          'destroy' in value &&
          typeof value.destroy === 'function'
        ) {
          value.destroy();
        }
        this.remove(value);
      }
    }
  }
}

/** @internal */
export const defaultCacheConfig = {
  retries: 3, // By default each query is executed 3 times
  retryDelay: 1000,
  refetchInterval: 300000, // Refetch the query each 5 min interval
  refetchOnReconnect: true,
  staleTime: 0, // By default query is mark stale automatically when it's fetch/refetch
  cacheTime: 300000, // After 5 minutes, if no subscriber listens to the query object, the query is invalidate
};

/** @interface */
export function useDefaultCacheConfig() {
  return defaultCacheConfig;
}

/**
 * @internal creates a queries cache instance
 */
export function createCache<T extends TypeDef = TypeDef>(logger?: Logger) {
  return new Cache<T>(logger);
}

/** @internal */
export function buildCacheQuery<
  T extends (...args: UnknownType) => UnknownType,
>(
  argument: [T, ...QueryArguments<T>],
  config?: CacheQueryConfig & { name?: string }
) {
  const args = argument as [T, ...QueryArguments<T>];
  let name!: string;
  if (config && typeof config.name !== 'undefined' && config.name !== null) {
    name = config.name;
  } else {
    const fn = args[0];

    if (typeof fn !== 'undefined' && fn !== null) {
      const descriptor = String('name' in fn ? fn.name : '').trim();
      const parameters = fn.toString().match(/\( *([^)]+?) *\)/gi);
      name =
        fn.prototype ??
        `${descriptor ?? `native anonymous`}${
          parameters ? parameters[0] : '()'
        } { ... }`;
    }
  }

  return [name, ...argument.slice(1)];
}
