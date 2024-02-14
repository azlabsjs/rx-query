//#region Cache types
import { Observable } from 'rxjs';

/**
 * Type declaration for logging frameworks implementation
 *
 * @internal
 */
export type Logger = {
  log(message: string, ...args: any): void;
};

/**
 * @internal
 */
export type CachedItemType = {
  id: string;
  expires: () => boolean;
};

/**
 * @internal
 */
export type QueriesCacheItemType = CachedItemType & {
  argument: unknown;
  retry: () => void;
  setExpiresAt: () => void;
  /**
   * Performs a background refetch of the item internal state
   */
  refetch: () => Promise<any>;
  /**
   * Invalidate the cached item and prevent any background fetch
   */
  invalidate: () => void;
  destroy: () => void;
  setError: (error: unknown) => void;
};

export type CacheType<T> = {
  /**
   * Removes all items from the cache system
   */
  clear: () => void;

  /**
   * Add an item to the cache
   *
   * @param item
   */
  add: (item: T) => void;

  /**
   * Check if the cache contains a specific key
   *
   * @param argument
   */
  has: (argument: unknown) => boolean;

  /**
   * Return the element in the cache matching the provided argument
   *
   * @param argument
   */
  get: (argument: unknown) => T | undefined;

  /**
   * Cache is empty if all element has been removed from the cache
   *
   * @returns
   */
  isEmpty: () => boolean;

  /**
   * Deletes an item from the cache
   *
   * @param argument
   */
  remove: (argument: unknown) => void;

  /**
   * Invalidate a gache item present in the cache
   */
  invalidate: (argument: unknown) => void;
};

export type CacheQueryConfig = {
  retries?: number | ((attempt: number, error: unknown) => boolean);
  retryDelay?: number | ((retryAttempt: number) => number);
  refetchInterval?: number | Observable<unknown>;
  refetchOnWindowFocus?: boolean;
  refetchOnReconnect?: boolean;
  staleTime?: number;
  cacheTime?: number;
  defaultView?: Window;
};

//#endregion
