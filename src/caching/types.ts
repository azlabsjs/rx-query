/** @internal */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UnknownType = any;

/** @description type declaration for logging frameworks implementation */
export type Logger = {
  log(message: string, ...args: UnknownType): void;
};

export type CacheType<T = UnknownType> = {
  /**
   * removes all items from the cache system
   */
  clear: () => void;

  /**
   * add an item to the cache
   *
   * @param item
   */
  add: (item: T) => void;

  /**
   * check if the cache contains a specific key
   *
   * @param argument
   */
  has: (argument: unknown) => boolean;

  /**
   * return the element in the cache matching the provided argument
   *
   * @param argument
   */
  get: (argument: unknown) => T | undefined;

  /**
   *  @description cache is empty if all element has been removed from the cache
   *
   */
  isEmpty: () => boolean;

  /**
   * @description invalidate a gache item present in the cache
   */
  delete: (argument: unknown) => void;
};

/** @description cache query configuration */
export type CacheQueryConfig = {
  retries?: number | ((attempt: number, error: unknown) => boolean);
  retryDelay?: number | ((retryAttempt: number) => number);
  refetchInterval?: number;
  refetchOnWindowFocus?: boolean;
  refetchOnReconnect?: boolean;
  staleTime?: number;
  cacheTime?: number;
  defaultView?: Window;
};
