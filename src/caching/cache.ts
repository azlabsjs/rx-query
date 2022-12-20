import { useRxEffect } from "@azlabsjs/rx-hooks";
import { deepEqual, isPrimitive } from "@azlabsjs/utilities";
import {
  asyncScheduler,
  catchError,
  EMPTY,
  filter,
  first,
  from,
  interval,
  isObservable,
  lastValueFrom,
  mergeMap,
  Observable,
  ObservableInput,
  observeOn,
  Subject,
  takeUntil,
  tap
} from "rxjs";
import { CacheQueryConfig, RequestsCacheItemType } from "./types";

/**
 * Internal caching implementation of requests.
 *
 * @internal
 */
export class RequestsCache<
  T extends RequestsCacheItemType = RequestsCacheItemType
> {
  /**
   * @internal
   *
   * State of the cache instance
   */
  private _state: T[] = [];

  get length() {
    return this._state.length;
  }

  /**
   * Removes all items from the cache system
   */
  clear() {
    for (const request of this._state ?? []) {
      request.destroy();
    }
    this._state = [];
  }

  /**
   * Add an item to the cache
   *
   * @param item
   */
  add(item: T): void {
    this._state = [item, ...(this._state ?? [])];
  }

  /**
   * Check if the cache contains a specific key
   *
   * @param argument
   */
  contains(argument: unknown) {
    return this.indexOf(argument) !== -1;
  }

  /**
   * Return the element in the cache matching the provided argument
   *
   * @param argument
   */
  get(argument: unknown) {
    return this.at(this.indexOf(argument));
  }

  /**
   * Cache is empty if all element has been removed from the cache
   *
   * @returns
   */
  isEmpty() {
    return this.length === 0;
  }

  /**
   * Deletes an item from the cache
   *
   * @param argument
   */
  remove(argument: unknown) {
    return this.removeAt(this.indexOf(argument));
  }

  //#region Miscellanous
  at(index: number) {
    return index === -1 || index > this._state.length - 1
      ? undefined
      : this._state[index];
  }

  removeAt(index: number) {
    const items = [...this._state];
    const values = items.splice(index, 1);
    // When removing element from cache we call destroy method
    // in order to unsubscribe to any observable being run internally
    for (const request of values) {
      request.destroy();
    }
    this._state = items;
  }

  indexOf(argument: unknown) {
    // First we apply an strict equality on the request id and payload against
    // the query value
    if (isPrimitive(argument)) {
      return this._state.findIndex(
        (request) => request.id === argument || request.argument === argument
      );
    }
    // Case the key is not found, index will still be -1, therefore we search
    return this._state.findIndex((request) => {
      if (
        ((typeof request.argument === "undefined" ||
          request.argument === null) &&
          typeof argument !== "undefined" &&
          argument !== null) ||
        ((typeof argument === "undefined" || argument === null) &&
          typeof request.argument !== "undefined" &&
          request.argument !== null)
      ) {
        return false;
      }
      return deepEqual(request.argument, argument);
    });
  }

  invalidate(argument: unknown) {
    const cahedRequest = this.at(this.indexOf(argument));
    if (cahedRequest) {
      cahedRequest.setExpiresAt();
    }
  }
  //#region Miscellanous
}

/**
 * Caching object used by the { @see RequestsCache } object when handling request caching
 * refetches, and retries.
 *
 * @internal
 */
export class CachedRequest {
  //#region Properties definitions
  private tries = 0;
  private lastError!: unknown;
  private lastResponse!: unknown;
  private readonly clearRefetch$ = new Subject<void>();
  private readonly destroy$ = new Subject<void>();
  private _expiresAt!: Date | undefined;
  private _isStale: boolean = false;
  //#endregion Properties definitions

  private onWindowReconnect = () => {
    this.refetch();
  };

  private onWindowFocus = () => {
    this.refetch();
  };

  //#region Properties accessors
  get id() {
    return this._id;
  }
  get argument() {
    return this._argument;
  }

  get isStale() {
    return this._isStale;
  }

  get response() {
    return this.lastResponse;
  }

  get retryState() {
    return {
      tries: this.tries,
      lastError: this.lastError,
      payload: this._argument,
      id: this.id,
    };
  }
  //#endregion Properties accessors

  // Creates an instance of {@see CachedRequest} class
  constructor(
    private _id: string,
    private _argument: unknown,
    private properties: CacheQueryConfig,
    private readonly callback: () => ObservableInput<unknown>,
    private refetchCallback?: (response: unknown) => void,
    private errorCallback?: (error: unknown) => void,
    view?: Window,
    lastError?: unknown
  ) {
    const { refetchInterval, refetchOnReconnect, refetchOnWindowFocus } =
      this.properties;

    // Mark the data as state
    this.markAsStale();

    // Configure the refresh interval
    if (refetchInterval) {
      this.configureRefetchInterval(refetchInterval);
    }
    if (refetchOnReconnect) {
      // TODO: Inject the window instance in the constructor and use it in the current call
      this.refetchOnReconnect(view);
    }
    if (refetchOnWindowFocus) {
      // TODO: Inject the window instance in the constructor and use it in the current call
      this.refetchOnFocus(view);
    }

    if (typeof lastError !== "undefined" && lastError !== null) {
      this.lastError = lastError;
      this.retry();
    }
  }

  private configureRefetchInterval(
    refetchInterval?: number | Observable<unknown>
  ) {
    if (typeof refetchInterval === "undefined" || refetchInterval === null) {
      return;
    }
    (isObservable(refetchInterval)
      ? refetchInterval
      : interval(refetchInterval)
    )
      .pipe(
        filter(() => this._isStale),
        mergeMap(() => {
          return this.doRequest();
        }),
        takeUntil(this.clearRefetch$),
        takeUntil(this.destroy$)
      )
      .subscribe();
  }

  private refetchOnFocus(defaultWindow?: Window) {
    defaultWindow?.addEventListener("focus", this.onWindowFocus);
  }

  private refetchOnReconnect(defaultWindow?: Window) {
    defaultWindow?.addEventListener("online", this.onWindowReconnect);
  }

  private doRetry() {
    const { retryDelay } = this.properties;
    useRxEffect(
      interval(
        typeof retryDelay === "function"
          ? retryDelay(this.tries)
          : retryDelay ?? 1000
      ).pipe(
        first(),
        mergeMap(() => this.doRequest())
      )
    );
  }

  private doRequest() {
    return from(this.callback.apply(null)).pipe(
      observeOn(asyncScheduler),
      catchError((error) => {
        this.lastError = error;
        // If the tries is more than or equal to the configured tries, we trigger an error
        // call on the cached instance
        if (!this.canRetry() && typeof this.errorCallback === "function") {
          this.errorCallback(error);
        } else {
          // TODO : Retry the request if it fails
          this.retry();
        }
        // Returns an empty Observable to swallow the error
        return EMPTY;
      }),
      tap((response) => {
        this.lastError = undefined;
        this.lastResponse = response;
        // Unmark the request as stale after each successful request
        this._isStale = false;
        if (this.refetchCallback) {
          this.refetchCallback(response);
        }
        // Mark the request as state based on the staleTime configuration
        this.markAsStale();
      })
    );
  }

  private markAsStale() {
    if (
      typeof this.properties.staleTime === "undefined" ||
      this.properties.staleTime === null ||
      this.properties.staleTime === 0
    ) {
      this._isStale = true;
    } else {
      interval(this.properties.staleTime)
        .pipe(
          first(),
          tap(() => {
            this._isStale = true;
          }),
          takeUntil(this.destroy$)
        )
        .subscribe();
    }
  }

  private canRetry() {
    return (
      (typeof this.properties.retries === "number" &&
        this.tries <= this.properties.retries) ||
      (typeof this.properties.retries === "function" &&
        this.properties.retries(this.tries, this.lastError))
    );
  }

  setError(error: unknown) {
    this.lastError = error;
  }

  setExpiresAt() {
    const date = new Date();
    date.setMilliseconds(
      date.getMilliseconds() + (this.properties?.cacheTime ?? 500000)
    );
    this._expiresAt = date;
  }

  expires() {
    return (
      typeof this._expiresAt !== "undefined" &&
      this._expiresAt !== null &&
      this._expiresAt.getTime() - new Date().getTime() < 0
    );
  }

  // Handle retry action on the cached request
  retry() {
    if (this.canRetry()) {
      this.tries += 1;
      return this.doRetry();
    }
    // Stop refetch observable listener
    this.clearRefetch$!.next();
  }

  async refetch() {
    // If the data is not marked as stale, we don't update
    // the state of the data
    if (!this.isStale) {
      return;
    }
    // Clear refetch to stop the current refetch observable
    this.clearRefetch$!.next();
    const { refetchInterval } = this.properties;
    // Do a request request to update the state
    await lastValueFrom(this.doRequest());
    // Reconfigure the refetch action
    if (refetchInterval) {
      this.configureRefetchInterval(refetchInterval);
    }
  }

  destroy() {
    window?.removeEventListener("online", this.onWindowReconnect);
    window?.removeEventListener("focus", this.onWindowFocus);
    this.clearRefetch$!.next();
    this.destroy$.next();
  }
}
