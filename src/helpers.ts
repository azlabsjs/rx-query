import {
  Observable,
  OperatorFunction,
  from,
  isObservable,
  map,
  of,
} from 'rxjs';
import { queryResult } from './rx';
import {
  CacheQueryProviderType,
  ObserveKeyType,
  QueryArguments,
  QueryState,
  QueryStateLeastParameters,
  QueryStates,
} from './types';
import { useQueryManager } from './singleton';
import { useQuerySelector as internalUseQuerySelector } from './internal';

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

/**
 * Query [body] stream of the query response if any or returns the
 * entire response if none
 *
 */
export function queryResultBody<TResult = unknown>(
  key?: string
): OperatorFunction<QueryState, TResult> {
  return (observable$: Observable<QueryState>) =>
    observable$.pipe(
      queryResult((query) => {
        key = key ?? 'body';
        const response = query.response as Record<string, unknown>;
        return response && typeof response === 'object' && key in response
          ? response[key]
          : response;
      })
    ) as Observable<TResult>;
}

/** @internal */
export type Logger = {
  log(message: string, ...args: unknown[]): void;
};

/** @internal */
export function parseQueryArguments<T>(
  params: T,
  _args: [...QueryStateLeastParameters<T>]
) {
  const _params = params as unknown;
  let _arguments!: [...QueryStateLeastParameters<T>];
  let _query!: T;
  let observe!: ObserveKeyType;
  if (
    (_params as CacheQueryProviderType).query &&
    typeof (_params as CacheQueryProviderType).query === 'function'
  ) {
    const queryFunction = (...args: unknown[]) => {
      return (_params as CacheQueryProviderType).query(...args);
    };
    _query = queryFunction.bind(_params) as unknown as T;
    const cacheConfig = (_params as CacheQueryProviderType).cacheConfig;
    _arguments = (
      typeof cacheConfig !== 'undefined' && cacheConfig !== null
        ? [...(_args ?? []), cacheConfig]
        : _args ?? []
    ) as [...QueryStateLeastParameters<T>];
  } else if (typeof params === 'function') {
    _query = _params as T;
    _arguments = _args;
  }
  return [_query, _arguments, observe] as [
    T,
    [...QueryStateLeastParameters<T>],
    ObserveKeyType
  ];
}

/**
 * @description Provides developpers with a function for type interence as typescript `as` operator
 *
 * ```ts
 * // Suppose the given value
 * let value = 1;
 *
 * // Using typescript  `as` operator
 * value = value as String;
 *
 * // Using the as global function
 * value = as<String>(value);
 * ```
 */
export function as<T>(value: unknown) {
  return value as T;
}

/** @description Provides developpers with a function for observables type interence */
export function observableReturnType<T>(value: unknown) {
  return value as Observable<T>;
}

/**
 * @description Provides developpers with a function for type interence as typescript `as` operator
 *
 * ```ts
 * // Suppose the given value
 * let value = 1;
 *
 * // Using typescript  `as` operator
 * value = value as String;
 *
 * // Using the returnType global function
 * value = returnType<String>(value);
 * ```
 */
export const returnType = as;

/**
 * Create query instance that caches (if required by user) it arguments
 * and replay / refetch it based on the interval defined by the library user
 *
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useQuery<T>(
  params: T,
  ...args: [...QueryStateLeastParameters<T>]
) {
  return _useQuery(null, params, ...args);
}

/**
 * Observable query factory that memoize query result and replay/refetch
 * base on provided caching configuration.
 *
 * **Note** Provided logger object `console.log` for instance when provided is
 * used to
 */
export function useDebug<TReturn = any>(logger: Logger) {
  return <T>(params: T, ...args: [...QueryStateLeastParameters<T>]) =>
    observableReturnType<TReturn>(_useQuery(logger, params, ...args));
}

/** @internal actual query factory function */
export function _useQuery<T>(
  logger: Logger | null,
  p: T,
  ...args: [...QueryStateLeastParameters<T>]
) {
  const [_query, _arguments, observe] = parseQueryArguments(p, args);
  let _observe = observe;
  const queryManager = useQueryManager(logger ? logger : undefined);
  const queryFunc = <TFunc extends (...args: any) => any>(
    query: TFunc,
    ...args: [...QueryArguments<TFunc>]
  ) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return queryManager(query, ...args);
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = queryFunc(_query as any, ...(_arguments ?? []));
  const _params = p as unknown;
  if (typeof (_params as CacheQueryProviderType).query === 'function') {
    _observe =
      observe ?? (_params as CacheQueryProviderType).cacheConfig.observe;
  }
  return (
    (!isObservable(result)
      ? of(result)
      : from(result)) as Observable<QueryState>
  ).pipe(
    _observe === 'response'
      ? queryResult()
      : ((_observe === 'body'
          ? queryResultBody()
          : map((state) => state)) as OperatorFunction<QueryState, unknown>)
  ) as Observable<any>;
}

/**
 * @deprecated `useQuerySelector` is intended to be used internal but
 * was exposed in previous release, but will be removed from version >=0.3.x
 */
export const useQuerySelector = internalUseQuerySelector;
