import { Observable, ObservableInput } from 'rxjs';
import { CacheQueryConfig } from './caching';

/** @internal */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type UnknownType = any;

//#region queries service types
/** @description Enumerated value of the query object state */
export enum QueryStates {
  LOADING = 'loading',
  SUCCESS = 'success',
  ERROR = 'error',
  REVALIDATE = 'revalidate',
}

/** @description Marks service or instance as disposable */
export interface Disposable {
  destroy(): void | Promise<void>;
}

/** @internal */
export type QueryState<TPayload = unknown> = {
  id: string;
  pending: boolean;
  state: QueryStates;
  argument: TPayload;

  /**
   * Performs a background refetch of the query response
   */
  refetch: () => void;

  /**
   * invalidate the cached query. Once the query is invalidated,
   * any subsequent call to fetch a new query response should not
   * provide from cache
   */
  invalidate: () => void;

  // Optional properties
  response?: unknown;
  method?: string;
  ok?: boolean;
  error?: unknown;
  timestamps: {
    createdAt?: number;
    updatedAt?: number;
  };
};

/** @internal */
export type QueryPayload<
  TFunc extends (...args: UnknownType[]) => void = (...args: UnknownType[]) => void
> = {
  argument: [string, TFunc, ...QueryArguments<TFunc>];
  callback: () => ObservableInput<unknown>;
  id: string;
};

/** @internal */
export type FnActionArgumentLeastType = CacheQueryConfig & {
  name: string;
  cacheQuery: boolean;
};

/** @internal */
export type QueryArguments<F> = F extends (
  ...args: infer A
) => ObservableInput<unknown>
  ? [...A, FnActionArgumentLeastType] | [...A]
  : never;

/** @internal */
export type ObservableInputFunction = (
  ...args: unknown[]
) => ObservableInput<unknown>;

/** @internal */
export type Action<T = unknown> = {
  name: string;
  payload?: T;
};

/** @description Query comment interface */
export interface CommandInterface<R = unknown> {
  dispatch<T extends (...args: UnknownType[]) => void>(
    action: T,
    ...args: [...QueryArguments<T>]
  ): R;
}

/** @description Query manager interface */
export interface QueryManager<R> {
  invoke<T extends (...args: UnknownType[]) => void>(
    action: T,
    ...args: [...QueryArguments<T>]
  ): R;
}

/** @internal */
export type State = {
  performingAction: boolean;
  requests: QueryState[];
  lastRequest?: QueryState;
};

/**
 * @deprecated
 * 
 *  @internal
 */
export type BaseQueryType<TMethod extends string, TObserve = string> = {
  path: string;
  observe?: TObserve;
  method?: TMethod;
};

/**
 * @deprecated Will be removed from version 0.3.x as the API will only support closure
 * and `{ query(): Observable<unkown> }` instance as parameter
 * @description Query object type data structure
 */
export type QueryType<
  TMethod extends string = string,
  TObserve = string
> = BaseQueryType<TMethod, TObserve> & {
  body?: unknown;
  params?: Record<string, UnknownType> | { [prop: string]: string | string[] };
};

/** @internal */
export type QueryParameter<TFunc, TMethod extends string> = {
  methodOrConfig: QueryType<TMethod> | TFunc;
  arguments?: [...QueryArguments<TFunc>];
};

/** @description Query client base interface */
export type QueryClientType<TMethod extends string> = {
  /**
   * Sends a client query to a server enpoint and returns
   * an observable of response type
   *
   * @param query
   */
  invoke<TFunc extends ObservableInputFunction>(
    query: QueryType<TMethod> | TFunc,
    ...args: [...QueryArguments<TFunc>]
  ): Observable<QueryState>;
};

/** @description Provides implementation for querying a resource */
export type QueryProviderType<
  TQueryParameters extends [...UnknownType[]] = UnknownType,
  ProvidesType = UnknownType
> = {
  /**
   * Sends a client query to a server enpoint and returns
   * an observable of response type
   *
   * @param query
   */
  query: (...args: TQueryParameters) => Observable<ProvidesType>;
};

/** @description Functional type definition for user provided query function */
export type QueryProviderFunc<
  TQueryParameters extends [...UnknownType[]] = UnknownType,
  ProvidesType = UnknownType
> = (...args: TQueryParameters) => ObservableInput<ProvidesType>;
//#endregion

//#region useQuery type declarations
/** @description Union type declaration for query state to observe */
export type ObserveKeyType = 'query' | 'response' | 'body';

/** @internal */
type QueryProviderProvidesParamType<
  TParam extends [...unknown[]],
  T extends QueryProviderType<TParam>
> = Parameters<T['query']>;

/** @internal */
type QueryProviderQuerConfigType = {
  name: string;
  observe?: ObserveKeyType;
};

/** @internal */
export type QueryStateLeastParameters<F> = F extends (
  ...args: infer A
) => unknown
  ? [...A, FnActionArgumentLeastType] | [...A]
  : F extends QueryProviderType
  ? [...QueryProviderProvidesParamType<Parameters<F['query']>, F>]
  : never;

/** Cached query provider configuration type declaration */
export type CacheQueryProviderType = QueryProviderType & {
  cacheConfig: CacheQueryConfig & QueryProviderQuerConfigType;
};
//#endregion useQuery type declarations
