import {
  asyncScheduler,
  catchError,
  EMPTY,
  from,
  Observable,
  ObservableInput,
  observeOn,
  Subscriber,
  Subscription,
} from 'rxjs';
import { CacheQueryConfig, Logger, buildCacheQuery, Cache } from './caching';
import { guid } from './internal';
import {
  Disposable,
  FnActionArgumentLeastType,
  ObservableInputFunction,
  QueryArguments,
  QueryManager,
  QueryState,
  QueryStates,
  UnknownType,
} from './types';

type CachedQueryState = QueryState & {
  destroy: () => void;
  expires: () => boolean;
};

function createobservable(
  cache: Map<string, QueryState>,
  req: () => ObservableInput<unknown>,
  properties: CacheQueryConfig,
  state: Partial<QueryState>,
  refetchCallback?: (response: unknown) => void,
  errorCallback?: (error: unknown) => void
) {
  let subscription: Subscription | undefined = undefined;
  let staled: boolean = false;
  let lastError: unknown = undefined;
  let tries: number = 0;
  let requesting: boolean = false;

  //
  const _req = req;
  const { defaultView: runtime, retries, staleTime } = properties;
  let _subscriber: Subscriber<unknown>;
  let _interval: number | undefined;
  let _state: CachedQueryState = createInitialState(state);

  // destructure `_state` variable to get id property
  // const { id } = _state;

  function _clearInterval() {
    // Log('Clearing interval...');
    // stop refetch observable listener
    if (_interval) {
      clearInterval(_interval);
    }
  }

  function _onRuntimeReconnect() {
    refetch();
  }

  function _onRuntimeFocus() {
    refetch();
  }

  function _refetchOnFocus() {
    if (runtime) {
      runtime.addEventListener('focus', _onRuntimeFocus);
    }
  }

  function _refetchOnReconnect() {
    if (runtime) {
      runtime.addEventListener('online', _onRuntimeReconnect);
    }
  }

  function _refetchOnInterval(req: () => ObservableInput<unknown>, ms: number) {
    if (typeof ms === 'undefined' || ms === null) {
      return;
    }

    if (typeof ms === 'number' && (ms < 0 || ms === Infinity)) {
      return;
    }

    _interval = setInterval(() => request(req), ms) as unknown as number;
  }

  function createInitialState(state: Partial<QueryState>): CachedQueryState {
    return {
      ...state,
      pending: true,
      timestamps: {
        createdAt: Date.now(),
      },
      refetch: () => {
        refetch();
      },
      invalidate: () => {
        if (_state.id) {
          cache.delete(_state.id);
          _state.destroy();
        }
      },
      state: QueryStates.LOADING,
    } as CachedQueryState;
  }

  function _createResponsePayload<T>(s: CachedQueryState, response: T) {
    return {
      ...s,
      response,
      timestamps: {
        ...(s.timestamps ?? {}),
        updatedAt: Date.now(),
      },
      ok: true,
      state: QueryStates.SUCCESS,
    };
  }

  function _createErrorPayload(s: CachedQueryState, error: unknown) {
    return {
      ...s,
      error,
      timestamps: {
        ...(s.timestamps ?? {}),
        updatedAt: Date.now(),
      },
      ok: false,
      state: QueryStates.ERROR,
    };
  }

  function _setState(s: CachedQueryState) {
    _state = s;
    if (_state.id) {
      cache.set(_state.id, _state);
    }
  }

  async function refetch() {
    // clear refetch to stop the current refetch observable
    _clearInterval();
    const { refetchInterval } = properties;

    // do a query to update the state
    request(_req);

    // reconfigure the refetch action
    if (refetchInterval) {
      _refetchOnInterval(_req, refetchInterval);
    }
  }

  function canRetry() {
    return (
      (typeof retries === 'number' && tries <= retries) ||
      (typeof retries === 'function' && retries(tries, lastError))
    );
  }

  function markStaled() {
    if (
      typeof staleTime === 'undefined' ||
      staleTime === null ||
      staleTime === 0
    ) {
      staled = true;
    } else {
      const t = setTimeout(() => {
        staled = true;
        clearTimeout(t);
      }, staleTime);
    }
  }

  function retry() {
    // case cannot retry, we drop out of the execution context
    if (!canRetry()) {
      return;
    }

    tries += 1;
    const { retryDelay } = properties;
    let delay: number;
    if (typeof retryDelay === 'function') {
      delay = retryDelay(tries);
    } else {
      delay = retryDelay ?? 1000;
    }

    const timeout = setTimeout(() => {
      request(_req);
      clearTimeout(timeout);
    }, delay);
  }

  function request(req: () => ObservableInput<unknown>) {
    if (!staled || requesting) {
      return;
    }
    // Log('Executing request...', staled, requesting);

    requesting = true;
    // before executing a new request, unsubscribe from current context
    const observable$ = from(req()).pipe(
      observeOn(asyncScheduler),
      catchError((error) => {
        lastError = error;
        // if the tries is more than or equal to the configured tries,
        // we trigger an error call on the cached instance
        if (!canRetry() && typeof errorCallback === 'function') {
          errorCallback(error);
        } else {
          retry();
        }
        // return an empty Observable to swallow the error
        return EMPTY;
      })
    );

    if (subscription) {
      subscription.unsubscribe();
    }

    if (_subscriber) {
      subscription = observable$.subscribe({
        next: (response) => {
          requesting = false;
          // unmark the query as stale after each successful state
          // set lastError to undefined if request ends successfully
          lastError = undefined;
          staled = false;

          // update request state
          _setState(_createResponsePayload(_state, response));

          if (refetchCallback) {
            refetchCallback(response);
          }

          // mark the query as stale based on the staleTime configuration
          markStaled();

          // next the response to the subscriber to updated current value
          _subscriber.next(_state);
        },
        error: (err) => {
          requesting = false;
          _setState(_createErrorPayload(_state, err));
        },
      });
    }
  }

  return new Observable<CachedQueryState>((subscriber) => {
    const _unsubscribe = subscriber.unsubscribe.bind(subscriber);
    const _overridenSubscribe = () => {
      // we clear any background task whenever we unsubscribe from the subscriber
      // we prevent resources leaks
      _clearInterval();
      _unsubscribe();
    };
    Object.defineProperty(subscriber, 'unsubscribe', {
      value: _overridenSubscribe,
      writable: true, // Allows the 'greet' method to be reassigned later
      enumerable: true, // Makes 'greet' show up in Object.keys(), for...in, etc.
      configurable: true, // Allows the property to be deleted or its descriptor changed
    });
    // set the _subscriber to equal observable subscriber, in order to notify it
    // when background task completes
    _subscriber = subscriber;

    if (_state.id && cache.has(_state.id)) {
      subscriber.next(cache.get(_state.id) as CachedQueryState);
    } else {
      // we subscribe to the request only when users subscribes to it
      subscriber.next(_state);
      subscription = from(_req())
        .pipe(observeOn(asyncScheduler))
        .subscribe({
          next: (response) => {
            requesting = false;
            _setState(_createResponsePayload(_state, response));

            // mark the query as stale based on the staleTime configuration
            markStaled();

            // Next the response to the subscriber to updated current value
            _subscriber.next(_state);
          },
          error: (err) => {
            requesting = false;
            subscriber.error(err);
            _setState(_createErrorPayload(_state, err));
          },
        });
    }

    const { refetchInterval, refetchOnReconnect, refetchOnWindowFocus } =
      properties;

    if (refetchInterval) {
      _refetchOnInterval(_req, refetchInterval);
    }

    if (refetchOnReconnect) {
      _refetchOnReconnect();
    }

    if (refetchOnWindowFocus) {
      _refetchOnFocus();
    }

    return function () {
      // cleanup
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  });
}


/** @internal */
export class Requests
  implements QueryManager<Observable<QueryState>>, Disposable
{
  // List of request cached by the current instance
  private _cache!: Cache<CachedQueryState>;
  // Provides an accessor to the request
  get cache() {
    return this._cache;
  }

  // Class constructor
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_?: Logger) {}

  /**
   * Static function for creating a request uuid that is
   * used to uniquely identify the request in the store
   * of application request
   *
   * @return string
   */
  static guid() {
    return guid();
  }

  invoke<T extends (...args: UnknownType) => void>(
    action: T,
    ...args: QueryArguments<T>
  ) {
    const config = (
      (action as (...args: unknown[]) => void).length < args.length
        ? args[args.length - 1]
        : undefined
    ) as FnActionArgumentLeastType;

    // case the last value passed as argument is an instance of {@see FnActionArgumentLeastType}
    // we call the function with the slice of argument from the beginning to the element before the last element
    const _action = action as unknown as ObservableInputFunction;
    const argument: [
      ObservableInputFunction,
      ...QueryArguments<typeof action>,
    ] = [
      _action,
      ...(((config as FnActionArgumentLeastType)?.cacheQuery || args.length > 1
        ? [...args].slice(0, args.length - 1)
        : args) as QueryArguments<typeof action>),
    ];

    // compare functions in javascript is tedious, and error prone, therefore we will only rely
    // not rely on function prototype when searching cache for cached item by on constructed action
    const _arguments = buildCacheQuery([...argument], config);
    const item = this.cache.get(_arguments);
    const uuid = item ? item.id : Requests.guid();
    const _least = argument.slice(2) as [...QueryArguments<typeof action>];

    return createobservable(this.cache, () => _action(..._least), config, {
      id: uuid,
      argument: _arguments,
    });
  }

  destroy() {
    this.cache.clear();
  }
}

/**
 * creates an instance of the query manager class
 * It's a factory function that creates the default query manager instance
 */
export function createQueryManager(logger?: Logger) {
  return new Requests(logger);
}
