import { Observable, finalize } from 'rxjs';
import { CacheType, QueriesCacheItemType } from './caching';
import { selectQuery } from './rx';
import { QueryState, State } from './types';

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
export function refetchQuery(query: QueryState) {
  if (typeof query.refetch === 'function') {
    query.refetch();
  }
}
