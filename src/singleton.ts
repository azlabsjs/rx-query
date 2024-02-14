import { Observable } from 'rxjs';
import { createQueryManager } from './base';
import { QueryArguments, QueryManager, QueryState } from './types';
import { Logger } from './caching';

/**
 * Holds a static reference to the query manager instance
 * It's kind of anti-pattern to use global object, but for fameworks that does not
 * provide DI / DI container, we are required to use a singleton pattern to provide a static
 * instance of the query manager.
 *
 */
let instance!: QueryManager<Observable<QueryState>>;

/**
 * @internal
 */
type InvokeQueryType<R> = <T extends (...args: any) => void>(
  action: T,
  ...args: [...QueryArguments<T>]
) => R;

/**
 * Provides a query manager singleton that might be used to handle queries of the application
 * that might or might not require caching.
 *
 * **Note**
 * Because the function uses a global singleton, developper is required to use it with
 * caution. It's mainly for fameworks that does not provide DI / DI container. If using
 * framework like angular, prefer usage @azlabjs/ngx-query {@see useQuery()} function
 * or {@see QueryProvider} service
 */
export function useQueryManager(logger?: Logger) {
  function createClosure(manager: QueryManager<Observable<QueryState>>) {
    return <T extends (...args: any) => void>(
      action: T,
      ...args: [...QueryArguments<T>]
    ) => {
      return manager.invoke.bind(manager)(action, ...args);
    };
  }
  if (instance === null || typeof instance === 'undefined') {
    const closure = createClosure(createQueryManager(logger));
    Object.defineProperty(closure, 'invoke', {
      value: <T extends (...args: any) => void>(
        action: T,
        ...args: [...QueryArguments<T>]
      ) => {
        return instance.invoke(action, ...args);
      },
    });
    instance = closure as unknown as QueryManager<Observable<QueryState>>;
  }
  return instance as QueryManager<Observable<QueryState>> &
    InvokeQueryType<Observable<QueryState>>;
}
