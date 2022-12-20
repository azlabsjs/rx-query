/**
 * @internal
 */
export const defaultCacheConfig = {
  retries: 3, // By default each query is executed 3 times
  retryDelay: 1000,
  refetchInterval: 300000, // Refetch the query each 5 min interval
  refetchOnReconnect: true,
  staleTime: 0, // By default query is mark stale automatically when it's fetch/refetch
  cacheTime: 300000, // After 5 minutes, if no subscriber listens to the query object, the query is invalidate
};
