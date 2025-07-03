import {
  Observable,
  OperatorFunction,
  distinctUntilChanged,
  filter,
  first,
  map,
} from 'rxjs';
import { QueryState } from './types';

/** @internal creates a selector that return the first value matching a given predicate */
export function firstWhere<T = unknown>(predicate: (value: T) => boolean) {
  return (observable$: Observable<T>) =>
    observable$.pipe(filter(predicate), first());
}

/** @description rxjs operator that returns the api response from */
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
