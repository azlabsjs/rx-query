import { CacheQueryConfig, Logger, UnknownType } from './types';
import { _useQuery, useQuery } from './helpers';
import {
  ObserveKeyType,
  QueryProviderType,
  QueryStateLeastParameters,
} from './types';
import { useDefaultCacheConfig } from './caching';

/**
 * Class property decorator sending query.
 *
 * It caches the the result of the query and refetch it in the background
 * if client requested it to do so.
 *
 * It uses the logger to log query result changes for debugging purpose
 *
 */
export const DebugQuery = <T>(
  logger: Logger,
  params: T,
  ...args: [...QueryStateLeastParameters<T>]
) => {
  return <TargetType>(target: TargetType, propertyKey: string) => {
    Object.defineProperty(target, propertyKey, {
      configurable: true,
      enumerable: true,
      writable: false, // freeze property value
      value: _useQuery(logger, params, ...args),
    });
  };
};

/**
 * class property decorator sending query.
 *
 * It caches the the result of the query and refetch it in the background
 * if client requested it to do so.
 *
 */
export const Query = <T>(
  params: T,
  ...args: [...QueryStateLeastParameters<T>]
) => {
  return <TargetType>(target: TargetType, propertyKey: string) => {
    Object.defineProperty(target, propertyKey, {
      configurable: true,
      enumerable: true,
      writable: false, // freeze property value
      value: _useQuery(null, params, ...args),
    });
  };
};

/**
 * decorates a class property use to send query
 *
 */
export const QueryDispatch = () => {
  return <TargetType>(target: TargetType, propertyKey: string) => {
    Object.defineProperty(target, propertyKey, {
      configurable: true,
      enumerable: true,
      writable: false, // freeze property value
      value: useQuery.bind(target),
    });
  };
};

/** @description decorates Query provider classes to add cache configuration values */
export function ProvidesQuery(
  cacheConfig?: (CacheQueryConfig & { observe?: ObserveKeyType }) | boolean
) {
  return <T extends new (...args: UnknownType[]) => QueryProviderType>(
    constructor: T
  ) => {
    const { name } = constructor;
    return class extends constructor {
      public readonly cacheConfig: CacheQueryConfig & {
        name: string;
        observe?: ObserveKeyType;
      } = {
        ...(typeof cacheConfig === 'boolean' && cacheConfig === true
          ? useDefaultCacheConfig()
          : cacheConfig),
        name: `query::bindTo[${name}]`,
      };
    };
  };
}
