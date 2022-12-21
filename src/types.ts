import { Observable, ObservableInput } from 'rxjs';
import { CacheQueryConfig } from './caching';

//#region queries service types
/**
 * @description Enumerated value of the query object state
 */
export enum QueryStates {
  LOADING = 'loading',
  SUCCESS = 'success',
  ERROR = 'error',
  REVALIDATE = 'revalidate'
}

export interface Disposable {
  destroy(): void | Promise<void>;
}

/**
 * @internal
 */
export type QueryState<TPayload = unknown> = {
  id: string;
  pending: boolean;
  state: QueryStates;
  argument: TPayload;
  // Refetch the query state
  refetch: () => void;

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

/**
 * @internal
 */
export type QueryPayload<
  TFunc extends (...args: any) => void = (...args: any) => void
> = {
  argument: [string, TFunc, ...QueryArguments<TFunc>];
  callback: () => ObservableInput<unknown>;
  id: string;
};

/**
 * @internal
 */
export type FnActionArgumentLeastType = CacheQueryConfig & {
  name: string;
  cacheQuery: boolean;
};

/**
 * @internal
 */
export type QueryArguments<F> = F extends (
  ...args: infer A
) => ObservableInput<unknown>
  ? [...A, FnActionArgumentLeastType] | [...A]
  : never;

/**
 * @internal
 */
export type ObservableInputFunction = (
  ...args: unknown[]
) => ObservableInput<unknown>;

/**
 * @internal
 */
export type Action<T = unknown> = {
  name: string;
  payload?: T;
};

/**
 * @description Query comment interface
 */
export interface CommandInterface<R = unknown> {
  dispatch<T extends (...args: any) => void>(
    action: T,
    ...args: [...QueryArguments<T>]
  ): R;
}

/**
 * @description Query manager interface
 */
export interface QueryManager<R> {
  invoke<T extends (...args: any) => void>(
    action: T,
    ...args: [...QueryArguments<T>]
  ): R;
}

/**
 * @internal
 */
export type State = {
  performingAction: boolean;
  requests: QueryState[];
  lastRequest?: QueryState;
};

/**
 * @internal
 */
export type BaseQueryType<TMethod extends string, TObserve = string> = {
  path: string;
  observe?: TObserve;
  method?: TMethod;
};

/**
 * @description Query object type data structure
 */
export type QueryType<
  TMethod extends string = string,
  TObserve = string
> = BaseQueryType<TMethod, TObserve> & {
  body?: unknown;
  params?: Record<string, any> | { [prop: string]: string | string[] };
};

/**
 * @internal
 */
export type QueryParameter<TFunc, TMethod extends string> = {
  methodOrConfig: QueryType<TMethod> | TFunc;
  arguments?: [...QueryArguments<TFunc>];
};

/**
 * @description Query client base interface
 */
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

/**
 * @description Provides implementation for querying a resource
 */
export type QueryProviderType<
  TQueryParameters extends [...any[]] = any,
  ProvidesType = any
> = {
  /**
   * Sends a client query to a server enpoint and returns
   * an observable of response type
   *
   * @param query
   */
  query: (...args: TQueryParameters) => Observable<ProvidesType>;
};

/**
 * @description Functional type definition for user provided query function
 */
export type QueryProviderFunc<
  TQueryParameters extends [...any[]] = any,
  ProvidesType = any
> = (...args: TQueryParameters) => ObservableInput<ProvidesType>;
//#endregion
