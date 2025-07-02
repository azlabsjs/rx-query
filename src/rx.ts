import {
  Observable,
  OperatorFunction,
  distinctUntilChanged,
  filter,
  first,
  map,
} from 'rxjs';
import { QueryState, State } from './types';

/**
 * Creates a selector that return the first value matching a given predicate
 *
 * @internal
 */
export function firstWhere<T = unknown>(predicate: (value: T) => boolean) {
  return (observable$: Observable<T>) =>
    observable$.pipe(filter(predicate), first());
}

/**
 * @description RxJS operator that returns the api response from
 */
export function queryResult<TResponse>(
  project?: (query: QueryState) => TResponse
): OperatorFunction<QueryState, TResponse> {
  return (observable$: Observable<QueryState>) =>
    observable$.pipe(
      filter((query) => !query.pending),
      distinctUntilChanged(),
      project ? map(project) : map((query) => query.response as TResponse)
    );
}


/**
 * @description provides a selector of query that can be applied on a query state observable
 */
export function selectQuery(argument: unknown) {
  return (observable$: Observable<State>) =>
    observable$.pipe(
      map((state) => state.requests.find((query) => query.id === argument)),
      filter((state) => typeof state !== 'undefined' && state !== null)
    ) as Observable<QueryState>;
}
