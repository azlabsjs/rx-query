import { deepEqual, isPrimitive } from '@azlabsjs/utilities';
import { QueryArguments, UnknownType } from '../types';
import { CacheQueryConfig, Logger } from './types';

// @internal
type TypeDef = {
  id: string | number;
  argument: unknown;
  destroy: () => void;
  expires: () => boolean;
};

/**
 * @internal internal caching implementation of queries.
 *
 */
export class Cache<T extends Partial<TypeDef> = Partial<TypeDef>> {
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
      if (typeof item.destroy === 'function') {
        item.destroy();
      }
    }
    this._state = [];
  }

  /**
   * add an item to the cache
   *
   * @param item
   */
  add(item: T): void {
    this.logger?.log(`Pushing into cache: `, item);
    this._state = [item, ...(this._state ?? [])];
    this.logger?.log(`Pushed into cache: `, this._state);
  }

  /**
   * checks if the cache contains a specific key
   *
   * @param argument
   */
  has(argument: unknown) {
    return this.indexOf(argument) !== -1;
  }

  /**
   * return the element in the cache matching the provided argument
   *
   * @param argument
   */
  get(argument: unknown) {
    return this.at(this.indexOf(argument));
  }

  /**
   * cache is empty if all element has been removed from the cache
   *
   * @returns
   */
  isEmpty() {
    return this.length === 0;
  }

  /**
   * deletes an item from the cache
   *
   * @param argument
   */
  remove(argument: unknown) {
    return this.removeAt(this.indexOf(argument));
  }

  //#region Miscellanous
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
      if (value && typeof value.destroy === 'function') {
        value.destroy();
      }
    }
    this._state = items;
  }

  private indexOf(argument: unknown) {
    // first we apply an strict equality on the query id and payload against
    // the query value
    if (isPrimitive(argument)) {
      return this._state.findIndex(
        (query) => query.id === argument || query.argument === argument
      );
    }

    // case the key is not found, index will still be -1, therefore we search
    return this._state.findIndex((query) => {
      if (
        ((typeof query.argument === 'undefined' || query.argument === null) &&
          typeof argument !== 'undefined' &&
          argument !== null) ||
        ((typeof argument === 'undefined' || argument === null) &&
          typeof query.argument !== 'undefined' &&
          query.argument !== null)
      ) {
        return false;
      }

      return deepEqual(query.argument, argument);
    });
  }

  invalidate(argument: unknown) {
    this.logger?.log(`invalidating cache item: `, argument, this._state);
    const i = this.indexOf(argument);
    if (i !== -1) {
      const query = this.at(i);
      if (query && typeof query.destroy === 'function') {
        query.destroy();
      }
      this.removeAt(i);
    }
    this.logger?.log('invalidated cached item: ', this._state);
  }

  prune() {
    for (const value of this._state) {
      if (value && typeof value.expires === 'function' && value.expires()) {
        if (value && typeof value.destroy === 'function') {
          value.destroy();
        }
        this.remove(value);
      }
    }
  }
  //#endregion
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
export function createCache(logger?: Logger) {
  return new Cache(logger);
}

/** @internal */
export function buildCacheQuery<
  T extends (...args: UnknownType) => UnknownType,
>(
  argument: [T, ...QueryArguments<T>],
  config?: CacheQueryConfig & { name: string }
) {
  const args = argument as [T, ...QueryArguments<T>];
  let name!: string;
  if (config && typeof config.name !== 'undefined' && config.name !== null) {
    name = config.name;
  } else {
    const fn = args[1];
    const funcName = fn.name === '' ? undefined : fn.name;
    const parameters = fn.toString().match(/\( *([^)]+?) *\)/gi);
    name =
      fn.prototype ??
      `${funcName ?? `native anonymous`}${
        parameters ? parameters[0] : '()'
      } { ... }`;
  }
  return [args[0], name, ...argument.slice(2)];
}
