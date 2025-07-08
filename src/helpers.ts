import { Observable, OperatorFunction, map } from 'rxjs';
import { queryResult } from './rx';
import {
  CacheQueryProviderType,
  ObserveKeyType,
  QueryArguments,
  QueryState,
  QueryStateLeastParameters,
  QueryStates,
  UnknownType,
} from './types';
import { useQueryContext } from './context';

/** @interrnal creates query parameters by parsing query params options */
export function createQueryParams<
  TQuery = string | number | Record<string, unknown>,
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
 * refetch a given query instance
 */
export function refetchQuery<T>(query: T) {
  if (
    typeof query === 'object' &&
    query !== null &&
    'refetch' in query &&
    typeof query.refetch === 'function'
  ) {
    query.refetch();
  }
}

/**
 * invalidate query instance if exists. This action will remove item from cache
 * an stop any ongoing request to refetch the cached query in background
 */
export function invalidateQuery<T>(query: T) {
  if (
    typeof query === 'object' &&
    query !== null &&
    'invalidate' in query &&
    typeof query.invalidate === 'function'
  ) {
    query.invalidate();
  }
}

/** @internal */
export function isquerystate(p: unknown): p is QueryState {
  return typeof p === 'object' && p != null && 'state' in p && 'pending' in p;
}

/**
 * global function that allows developper to check if a query is
 * still runing and has not yet complete or in pending state
 */
export function queryIsLoading<T>(query: T) {
  if (isquerystate(query)) {
    return query.state === QueryStates.LOADING || query.pending === true;
  }
  return false;
}

/**
 * check if the query completed with error
 */
export function queryHasError(query: QueryState) {
  if (isquerystate(query)) {
    return query.state === QueryStates.ERROR;
  }
  return false;
}

/**
 * @description global function to check if the query is completed
 */
export function queryCompleted(query: QueryState) {
  return query.state === QueryStates.SUCCESS;
}

/** query [body] stream of the query response if any or returns the entire response if none */
export function queryResultBody<TResult = unknown>(
  key?: string
): OperatorFunction<QueryState, TResult> {
  return (source: Observable<QueryState>) =>
    source.pipe(
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

// @internal
function isQueryObject(p: unknown): p is CacheQueryProviderType {
  return (
    typeof p === 'object' &&
    p !== null &&
    'query' in p &&
    typeof p.query === 'function'
  );
}

/** @internal */
export function queryArguments<T>(
  query: T,
  args: [...QueryStateLeastParameters<T>]
) {
  let params: [...QueryStateLeastParameters<T>] = args;
  let q: T = query as unknown as T;
  let observe!: ObserveKeyType;

  if (isQueryObject(query)) {
    const fn = (...args: unknown[]) => {
      return query.query(...args);
    };
    q = fn.bind(query) as unknown as T;

    // append cache configuration to query parameters if
    // query instance has `cacheConfig` property
    const config = 'cacheConfig' in query ? query.cacheConfig : undefined;
    params = (
      typeof config !== 'undefined' && config !== null
        ? [...(args ?? []), config]
        : (args ?? [])
    ) as [...QueryStateLeastParameters<T>];

    // if observe property is defined on cache configuration
    // set value of the observe variable to the value of `observe` property
    // of `cacheConfig`
    if (
      config &&
      typeof config.observe !== 'undefined' &&
      config.observe !== null
    ) {
      observe = config.observe;
    }
  } else {
    const argument = args[args.length - 1];
    if (
      typeof argument === 'object' &&
      argument !== null &&
      'observe' in argument &&
      typeof argument.observe === 'string'
    ) {
      observe = argument.observe as ObserveKeyType;
    }
    console.log('Observe: ', observe, args);
  }

  return [q, params, observe] as [
    T,
    [...QueryStateLeastParameters<T>],
    ObserveKeyType,
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

/** @deprecated use `observale<T>(value) instead` */
export function observableReturnType<T>(value: unknown) {
  return observable<T>(value);
}

/** @description provides type cast developpers with a function for observables type interence */
export function observable<T>(value: unknown): Observable<T> {
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
export function useDebug<TReturn = UnknownType>(logger: Logger) {
  return <T>(params: T, ...args: [...QueryStateLeastParameters<T>]) =>
    observable<TReturn>(_useQuery(logger, params, ...args));
}

/** @internal actual query factory function */
export function _useQuery<T>(
  logger: Logger | null,
  p: T,
  ...args: [...QueryStateLeastParameters<T>]
) {
  const [q, _arguments, observe] = queryArguments(p, args);
  const m = useQueryContext(logger ? logger : undefined);
  const fn = <TFunc extends (...args: UnknownType) => UnknownType>(
    func: TFunc,
    ...args: [...QueryArguments<TFunc>]
  ) => {
    return m(func, ...args);
  };
  const result = fn(q as UnknownType, ...(_arguments ?? []));
  const operator =
    observe === 'response'
      ? queryResult()
      : observe === 'body'
        ? queryResultBody()
        : map((state) => state);

  return result.pipe(operator) as Observable<UnknownType>;
}

/** @descriptions calls javascript log function with date time information */
export function Log(...args: unknown[]) {
  console.log(`[${new Date().toLocaleString()}]`, ...args);
}
