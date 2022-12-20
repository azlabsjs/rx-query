import {
  Observable,
  OperatorFunction,
  distinctUntilChanged,
  filter,
  first,
  map
} from "rxjs";
import { QueryState, State } from "./types";

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
export function apiResponse<TResponse>(
  project?: (request: QueryState) => TResponse
): OperatorFunction<QueryState, TResponse> {
  return (observable$: Observable<QueryState>) =>
    observable$.pipe(
      filter((request) => !request.pending),
      distinctUntilChanged(),
      project ? map(project) : map((request) => request.response as TResponse)
    );
}

/**
 * Query [body] stream of the query response if any or returns the
 * entire response if none
 *
 */
export function apiResponseBody<TBody = unknown>(
  key?: string
): OperatorFunction<QueryState, TBody> {
  return (observable$: Observable<QueryState>) =>
    observable$.pipe(
      apiResponse((request) => {
        key = key ?? "body";
        const response = request.response as Record<string, any>;
        return response && typeof response === "object" && key in response
          ? response[key]
          : response;
      })
    );
}

/**
 * Provides a selector of query request that can be applied on a
 * query state observable
 */
export function selectRequest(argument: unknown) {
  return (observable$: Observable<State>) =>
    observable$.pipe(
      map((state) => state.requests.find((request) => request.id === argument)),
      filter((state) => typeof state !== "undefined" && state !== null)
    ) as Observable<QueryState>;
}
