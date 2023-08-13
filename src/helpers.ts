import { Observable, finalize } from 'rxjs';
import { CacheType, QueriesCacheItemType } from './caching';
import { selectQuery } from './rx';
import { QueryState, QueryStates, State } from './types';

/**
 * @interrnal
 *
 * Creates query parameters by parsing query params options
 */
export function createQueryParams<
  TQuery = string | number | Record<string, unknown>
>(query?: TQuery) {
  const queryType = typeof query;
  if (queryType === 'undefined' || query === null) {
    return '';
  }
  return queryType === 'string' || queryType === 'number'
    ? '/:id'
    : Object.keys(query as Record<string, unknown>).reduce((carry, current) => {
        carry += `/:${current}`;
        return carry;
      }, '');
}

/**
 * @internal
 *
 * Provides a query selector function that select a query
 * instance based on a given criteria
 */
export function useQuerySelector(
  ...[state$, cache]: [
    Observable<State>,
    CacheType<QueriesCacheItemType> | undefined
  ]
) {
  return (argument: unknown) => {
    return state$.pipe(
      selectQuery(argument),
      finalize(() => {
        cache?.invalidate(argument);
      })
    );
  };
}

/**
 * Refetch a given query instance
 */
export function refetchQuery<T extends Record<string, unknown>>(query: T) {
  if (
    typeof query === 'object' &&
    query !== null &&
    typeof query['refetch'] === 'function'
  ) {
    query.refetch();
  }
}

/**
 * Invalidate query instance if exists. This action will remove item from cache
 * an stop any ongoing request to refetch the cached query in background
 */
export function invalidateQuery<T extends Record<string, unknown>>(query: T) {
  if (
    typeof query === 'object' &&
    query !== null &&
    typeof query.invalidate === 'function'
  ) {
    query.invalidate();
  }
}

/**
 * Global function that allows developper to check if a query is
 * still runing and has not yet complete or in pending state
 */
export function queryIsLoading(query: QueryState) {
  return query.state === QueryStates.LOADING || query.pending === true;
}

/**
 * Check if the query completed with error
 */
export function queryHasError(query: QueryState) {
  return query.state === QueryStates.ERROR;
}

/**
 * Global function to check if the query is completed
 */
export function queryCompleted(query: QueryState) {
  return query.state === QueryStates.SUCCESS;
}
