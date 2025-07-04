import {
  asyncScheduler,
  catchError,
  EMPTY,
  from,
  Observable,
  ObservableInput,
  observeOn,
} from 'rxjs';
import { buildCacheQuery, Cache, createCache, TypeDef } from './caching';
import {
  CachedQueryState,
  CacheQueryConfig,
  Disposable,
  FnActionArgumentLeastType,
  Logger,
  ObservableInputFunction,
  QueryArguments,
  QueryManager,
  QueryState,
  QueryStates,
  UnknownType,
} from './types';
import { deepEqual } from '@azlabsjs/utilities';

export function guid() {
  function v4() {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  }

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

function createobservable(
  cache: Cache<CachedQueryState>,
  req: () => ObservableInput<unknown>,
  properties: CacheQueryConfig,
  state: Partial<QueryState>,
  refetchCallback?: (response: unknown) => void,
  errorCallback?: (error: unknown) => void
) {
  const _req = req;
  const {
    defaultView: runtime,
    retries,
    staleTime,
    cacheTime,
    retryDelay,
  } = properties ?? {};
  let _state: CachedQueryState = _createInitialState(state);
  const _cachedState = cache.get(createSearch(_state));
  const _hasExpired = _cachedState ? _expired(_cachedState) : true;

  // Log('cached item expired: ', _hasExpired);

  if (_cachedState && !_hasExpired && _cachedState.local?.observable) {
    // Log('cached item exist in cache, creating observable from source');
    // _state = _cachedState;
    const _observable$ = _cachedState.local.observable;
    return new Observable<CachedQueryState>((subscriber) => {
      // this create an infinite observable, which will emitted until the source
      // observable stop emitting
      _observable$.subscribe({
        next: (value) => subscriber.next(value),
        error: (err) => subscriber.error(err),
        complete: () => subscriber.complete(),
      });
    });
  }

  if (_cachedState && _hasExpired) {
    cache.remove(_cachedState);
    // Log('removed item from cache: ', cache.items());
  }

  function _clearInterval() {
    // Log('clearing interval...', _state.local?.interval);
    // stop refetch observable listener
    if (_state.local?.interval) {
      clearInterval(_state.local.interval);
    }
  }

  function _expired(s: CachedQueryState) {
    return (
      typeof s.expiresAt !== 'undefined' &&
      s.expiresAt !== null &&
      s.expiresAt.getTime() - new Date().getTime() < 0
    );
  }

  function _createExpireAt(date?: Date) {
    date = date ?? new Date();
    date.setMilliseconds(date.getMilliseconds() + (cacheTime ?? 500000));
    return date;
  }

  function _setExpiredAt(date?: Date) {
    _setState({ ..._state, expiresAt: _createExpireAt(date) });
  }

  function _destroy() {
    // Log('called destroy...');
    _clearInterval();

    if (runtime) {
      runtime.removeEventListener('focus', _onRuntimeFocus);
    }
    if (runtime) {
      runtime.removeEventListener('focus', _onRuntimeReconnect);
    }
  }

  function _onRuntimeReconnect() {
    _refetch();
  }

  function _onRuntimeFocus() {
    _refetch();
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
    // Log('calling refetch on interval...');
    _setInternalState(_state, {
      interval: setInterval(() => _request(req), ms) as unknown as number,
    });
  }

  function _setInternalState(
    s: CachedQueryState,
    state: Partial<CachedQueryState['local']>
  ) {
    _setState({
      ...s,
      local: {
        ...(s.local ?? {}),
        ...state,
      },
    });
  }

  function _createInitialState(state: Partial<QueryState>): CachedQueryState {
    return {
      ...state,
      pending: true,
      timestamps: { createdAt: Date.now() },
      state: QueryStates.LOADING,
      refetch: () => {
        _refetch();
      },
      invalidate: () => {
        _setExpiredAt();
        cache.remove(_state);
        _destroy();
      },
    } as CachedQueryState;
  }

  function _createResponsePayload<T>(s: CachedQueryState, response: T) {
    return {
      ...s,
      response,
      pending: false,
      ok: true,
      state: QueryStates.SUCCESS,
      timestamps: {
        ...(s.timestamps ?? {}),
        updatedAt: Date.now(),
      },
    };
  }

  function _createErrorPayload(s: CachedQueryState, error: unknown) {
    return {
      ...s,
      error,
      pending: false,
      ok: false,
      state: QueryStates.ERROR,
      timestamps: {
        ...(s.timestamps ?? {}),
        updatedAt: Date.now(),
      },
    };
  }

  function _setState(s: CachedQueryState) {
    // Log('Setting state: ', s);
    _state = s;

    // Remove _staled state
    cache.remove(createSearch(_state));

    // Add _state to cache ends
    cache.add(_state);
  }

  function _next(state: CachedQueryState) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { local: _, ...rest } = state;
    _state.local?.subscriber?.next(rest);
  }

  async function _refetch() {
    // Log('called refetch...');
    // clear refetch to stop the current refetch observable
    _clearInterval();
    const { refetchInterval } = properties;

    // do a query to update the state
    _request(_req);

    // reconfigure the refetch action
    if (refetchInterval) {
      _refetchOnInterval(_req, refetchInterval);
    }
  }

  function _canRetry() {
    const tries = _state.local?.tries ?? 0;
    const lastError = _state?.local?.lastError;
    return (
      (typeof retries === 'number' && tries <= retries) ||
      (typeof retries === 'function' && retries(tries, lastError))
    );
  }

  function _markStaled() {
    if (
      typeof staleTime === 'undefined' ||
      staleTime === null ||
      staleTime === 0
    ) {
      _setInternalState(_state, { staled: true });
    } else {
      const t = setTimeout(() => {
        _setInternalState(_state, { staled: true });
        clearTimeout(t);
      }, staleTime);
    }
  }

  function _retry() {
    // case cannot retry, we drop out of the execution context
    if (!_canRetry()) {
      return;
    }

    let tries = _state.local?.tries ?? 0;
    tries += 1;
    _setInternalState(_state, { tries });
    let delay: number;
    if (typeof retryDelay === 'function') {
      delay = retryDelay(tries);
    } else {
      delay = retryDelay ?? 1000; // By default we wait for 1s before running the retry request
    }

    const timeout = setTimeout(() => {
      _request(_req);
      clearTimeout(timeout);
    }, delay);
  }

  function _request(req: () => ObservableInput<unknown>) {
    if (!_state.local?.staled || !!_state.local?.requesting) {
      return;
    }
    _setInternalState(_state, { requesting: true });
    // before executing a new request, unsubscribe from current context
    const observable$ = from(req()).pipe(
      observeOn(asyncScheduler),
      catchError((error) => {
        _setInternalState(_state, { lastError: error });
        // if the tries is more than or equal to the configured tries,
        // we trigger an error call on the cached instance
        if (!_canRetry() && typeof errorCallback === 'function') {
          errorCallback(error);
        } else {
          _retry();
        }
        // return an empty Observable to swallow the error
        return EMPTY;
      })
    );

    // unsubscribe from the query observable
    _state.local?.subscription?.unsubscribe();

    if (_state.local?.subscriber) {
      const subscription = observable$.subscribe({
        next: (response) => {
          _setInternalState(_state, {
            requesting: false,
            lastError: undefined,
            staled: false,
          });

          // update request state
          _setState({
            ..._createResponsePayload(_state, response),
            expiresAt: _createExpireAt(),
          });

          if (refetchCallback) {
            refetchCallback(response);
          }

          // mark the query as stale based on the staleTime configuration
          _markStaled();

          // next the response to the subscriber to updated current value
          _next(_state);
        },
        error: (err) => {
          _setInternalState(_state, { requesting: false });
          _setState(_createErrorPayload(_state, err));
        },
      });

      _setInternalState(_state, { subscription: subscription });
    }
  }

  const o = new Observable<CachedQueryState>((subscriber) => {
    const _unsubscribe = subscriber.unsubscribe.bind(subscriber);
    const _overridenSubscribe = () => {
      // Log('called unsubscribe.');
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
    _setInternalState(_state, { subscriber: subscriber });

    // we subscribe to the request only when users subscribes to it
    _next(_state);

    // initial subscription
    const subscription = from(_req())
      .pipe(observeOn(asyncScheduler))
      .subscribe({
        next: (response) => {
          _setInternalState(_state, { requesting: false });
          _setState({
            ..._createResponsePayload(_state, response),
            expiresAt: _createExpireAt(),
          });

          // mark the query as stale based on the staleTime configuration
          _markStaled();

          // Next the response to the subscriber to updated current value
          _next(_state);
        },
        error: (err) => {
          _setInternalState(_state, { requesting: false });
          subscriber.error(err);
          _setState(_createErrorPayload(_state, err));
        },
      });
    _setInternalState(_state, { subscription: subscription });

    // case request is cached and request is configured to be executed on an interval basics
    // the local state in cache should have interval configured
    if (
      typeof _state.local?.interval === 'undefined' ||
      _state.local?.interval === null
    ) {
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
    }

    return function () {
      // cleanup
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  });

  _setInternalState(_state, { observable: o });

  return o;
}

/** @internal */
function createSearch<
  T extends { argument: UnknownType; id?: string },
  T2 extends QueryState,
>(value: T) {
  return (p: T2) => {
    if (value.id && p.id && p.id === value.id) {
      return true;
    }

    return (
      p.argument && value.argument && deepEqual(p.argument, value.argument)
    );
  };
}

/** @internal */
function iscache<T extends TypeDef>(p: object): p is Cache<T> {
  return (
    typeof p === 'object' &&
    p !== null &&
    typeof (p as Cache).clear === 'function' &&
    typeof (p as Cache).add === 'function' &&
    typeof (p as Cache).has === 'function' &&
    typeof (p as Cache).get === 'function' &&
    typeof (p as Cache).remove === 'function'
  );
}

/** @internal */
function islogger(p: object): p is Logger {
  return (
    typeof p === 'object' &&
    p !== null &&
    typeof (p as Logger).log === 'function'
  );
}
/** @internal */
export class Query implements QueryManager<Observable<QueryState>>, Disposable {
  // List of request cached by the current instance
  private _cache!: Cache<CachedQueryState>;

  // Provides an accessor to the request
  get cache() {
    return this._cache;
  }

  // Class constructor
  constructor(logger?: Logger | Cache<CachedQueryState>) {
    if (logger && iscache<CachedQueryState>(logger)) {
      this._cache = logger;
    } else if (
      typeof logger === 'undefined' ||
      logger == null ||
      islogger(logger)
    ) {
      this._cache = createCache(logger);
    } else {
      throw new Error(
        `Expected constructor parameter to be an instance of 'Cache<T>' or 'Logger', got ${
          typeof logger === 'object' && logger !== null
            ? (logger as object).constructor.prototype
            : typeof logger
        }`
      );
    }
  }

  invoke<T extends (...args: UnknownType) => UnknownType>(
    action: T,
    ...args: QueryArguments<T>
  ) {
    let config: FnActionArgumentLeastType | undefined = undefined;
    if ('length' in action && args.length > action.length) {
      config = args[args.length - 1];
    }

    // case the last value passed as argument is an instance of {@see FnActionArgumentLeastType}
    // we call the function with the slice of argument from the beginning to the element before the last element
    const _action = action as unknown as ObservableInputFunction;
    const argument: [
      ObservableInputFunction,
      ...QueryArguments<typeof action>,
    ] = [
      _action,
      ...((config
        ? [...args].slice(0, args.length - 1)
        : args) as QueryArguments<typeof action>),
    ];
    const least = argument.slice(1) as [...QueryArguments<typeof action>];
    const _callback = () => _action(...least);

    // compare functions in javascript is tedious, and error prone, therefore we will only rely
    // not rely on function prototype when searching cache for cached item by on constructed action
    const _arguments = buildCacheQuery([...argument], config);
    let item: QueryState | undefined = undefined;

    if (config && 'cacheQuery' in config && config.cacheQuery) {
      item = this.cache.get(createSearch({ argument: _arguments }));
    }

    return createobservable(this.cache, _callback, config ?? {}, {
      id: item ? item.id : guid(),
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
export function createQuery<T extends CachedQueryState = CachedQueryState>(
  logger?: Logger | Cache<T>
) {
  return new Query(logger as unknown as Logger | Cache<CachedQueryState>);
}
