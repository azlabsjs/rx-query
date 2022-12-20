import { deepEqual } from "@azlabsjs/utilities";
import { ObservableInput } from "rxjs";
import { QueryArguments } from "../types";
import { CachedRequest, RequestsCache } from "./cache";
import { defaultCacheConfig } from "./internal";
import { CacheQueryConfig, RequestsCacheItemType } from "./types";

/**
 * @interface
 */
export function useDefaultCacheConfig() {
  return defaultCacheConfig;
}

/**
 * Cached requests factory function for creating { @see CachedRequest } instances
 * @internal
 * @param prop
 */
export function cacheRequest(prop: {
  objectid: string;
  properties: CacheQueryConfig | boolean;
  callback: () => ObservableInput<unknown>;
  errorCallback?: (error: unknown) => void;
  refetchCallback?: (response: unknown) => void;
  window?: Window;
  lastError?: unknown;
  argument?: unknown;
}): RequestsCacheItemType {
  const {
    callback,
    refetchCallback,
    properties,
    lastError,
    objectid,
    argument,
    errorCallback,
  } = prop;
  return new CachedRequest(
    objectid,
    argument,
    typeof properties === "boolean" ||
    (typeof properties === "object" &&
      properties !== null &&
      deepEqual(properties, {}))
      ? defaultCacheConfig
      : properties,
    callback,
    refetchCallback,
    errorCallback,
    window,
    lastError
  );
}

/**
 * Creates a requests cache instance
 *
 * @internal
 */
export function requestsCache() {
  return new RequestsCache();
}

/**
 * @inteernal
 */
export function buildCacheQuery<T extends (...args: any) => any>(
  argument: [string, T, ...QueryArguments<T>],
  cacheConfig?: CacheQueryConfig & { name: string }
) {
  const _arguments = argument as [string, T, ...QueryArguments<T>];
  let name!: string;
  if (
    cacheConfig &&
    typeof cacheConfig.name !== "undefined" &&
    cacheConfig.name !== null
  ) {
    name = cacheConfig.name;
  } else {
    const fn = _arguments[1];
    const funcName = fn.name === "" ? undefined : fn.name;
    const parameters = fn.toString().match(/\( *([^)]+?) *\)/gi);
    name =
      fn.prototype ??
      `${funcName ?? `native anonymous`}${
        parameters ? parameters[0] : "()"
      } { ... }`;
  }
  return [_arguments[0], name, ...argument.slice(2)];
}
