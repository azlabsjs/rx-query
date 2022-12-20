import { Observable, finalize } from "rxjs";
import { CacheType, RequestsCacheItemType } from "./caching";
import { selectRequest } from "./rx";
import { QueryState, State } from "./types";

/**
 * @interrnal
 * 
 * Creates query parameters by parsing request params options
 */
export function createQueryParams<
  TQuery = string | number | Record<string, unknown>
>(query?: TQuery) {
  const queryType = typeof query;
  if (queryType === "undefined" || query === null) {
    return "";
  }
  return queryType === "string" || queryType === "number"
    ? "/:id"
    : Object.keys(query as Record<string, unknown>).reduce((carry, current) => {
        carry += `/:${current}`;
        return carry;
      }, "");
}

/**
 * @internal
 * 
 * Provides a request selector function that select a request
 * instance based on a given criteria
 */
export function useRequestSelector(
  ...[state$, cache]: [
    Observable<State>,
    CacheType<RequestsCacheItemType> | undefined
  ]
) {
  return (argument: unknown) => {
    return state$.pipe(
      selectRequest(argument),
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
  if (typeof query.refetch === "function") {
    query.refetch();
  }
}
