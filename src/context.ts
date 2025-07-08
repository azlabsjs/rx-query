import { Observable } from 'rxjs';
import { createQuery } from './queries';
import {
  Disposable,
  Logger,
  QueryArguments,
  QueryManager,
  QueryState,
  UnknownType,
} from './types';

/**
 * Holds a static reference to the query manager instance
 * It's kind of anti-pattern to use global object, but for fameworks that does not
 * provide DI / DI container, we are required to use a singleton pattern to provide a static
 * instance of the query manager.
 *
 */
let instance!: Readonly<QueryManager<Observable<QueryState>> & Disposable>;

/** @internal */
type InvokeQueryType<R> = <T extends (...args: UnknownType) => unknown>(
  action: T,
  ...args: [...QueryArguments<T>]
) => R;

/**
 * provides a query context singleton that might be used to handle queries of the application
 * that might or might not require caching.
 *
 * **Note**
 * because the function uses a global singleton, developper is required to use it with
 * caution. It's mainly for fameworks that does not provide DI / DI container.
 */
export function useQueryContext(logger?: Logger) {
  // query context closure factory function
  function createClosure(q: QueryManager<Observable<QueryState>>) {
    return <T extends (...args: UnknownType[]) => unknown>(
      action: T,
      ...args: [...QueryArguments<T>]
    ) => q.invoke.bind(q)(action, ...args);
  }

  if (instance === null || typeof instance === 'undefined') {
    const _instance = createQuery(logger);
    const closure = createClosure(_instance);

    Object.defineProperty(closure, 'invoke', {
      value: <T extends (...args: UnknownType[]) => void>(
        action: T,
        ...args: [...QueryArguments<T>]
      ) => _instance.invoke(action, ...args),
    });

    // define `destroy` method on the closure instance
    Object.defineProperty(closure, 'destroy', {
      value: () => _instance.destroy(),
    });

    // freeze the closure object to prevent mutation of the object
    instance = Object.freeze(
      closure as unknown as QueryManager<Observable<QueryState>> & Disposable
    );
  }

  return instance as QueryManager<Observable<QueryState>> &
    InvokeQueryType<Observable<QueryState>> &
    Disposable;
}
