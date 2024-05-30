import { CacheQueryConfig, Logger, useDefaultCacheConfig } from './caching';
import { _useQuery, useQuery } from './helpers';
import {
  ObserveKeyType,
  QueryProviderType,
  QueryStateLeastParameters,
} from './types';

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
      value: _useQuery(logger, params, ...args),
    });
  };
};

/**
 * Class property decorator sending query.
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
      value: _useQuery(null, params, ...args),
    });
  };
};

/**
 * Decorates a class property use to send query to backend server using the HTTP
 * Query client insterface
 *
 * @returns
 */
export const QueryDispatch = () => {
  return <TargetType>(target: TargetType, propertyKey: string) => {
    Object.defineProperty(target, propertyKey, {
      value: useQuery.bind(target),
    });
  };
};

/** @description Decorates Query provider classes to add cache configuration values */
export function ProvidesQuery(
  cacheConfig?: (CacheQueryConfig & { observe?: ObserveKeyType }) | boolean
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <T extends new (...args: any[]) => QueryProviderType>(
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
