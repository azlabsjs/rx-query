import { Observable, finalize } from 'rxjs';
import { CacheType, QueriesCacheItemType } from './caching';
import { selectQuery } from './rx';
import { State } from './types';

/**
 * Generates a v4 like universal unique identifier
 *
 * @internal
 */
export function guid() {
  const v4 = () => {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  };
  return (
    v4() +
    v4() +
    '-' +
    v4() +
    '-' +
    v4() +
    '-' +
    v4() +
    '-' +
    v4() +
    v4() +
    v4()
  );
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
