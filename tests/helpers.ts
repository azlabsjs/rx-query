import { Action, UnknownType } from '../src/types';
import {
  QueryConfigParamsType,
  RequestInterface,
  RequestsConfig,
  RESTQueryFunc,
} from './types';

/**
 * @internal
 */
export function buildQueryPath(
  name: string,
  method: string,
  path?: string,
  params?: Record<string, UnknownType>,
  config?: RequestsConfig
) {
  if (path === null || typeof path === 'undefined') {
    path = name.replace(new RegExp(`^${method}_`), '');
  }

  // When requests in the application must be global prefixed
  // We add the prefix to the path variable for each request being performed
  if (config?.prefix) {
    path = `${
      config.prefix.endsWith('/')
        ? config.prefix.substring(0, config.prefix.length - 1)
        : config.prefix
    }/${path}`;
  }

  // // Replace request parameters with their values
  // params = params ?? options?.params ?? undefined;
  if (params) {
    for (const key in params) {
      if (Object.prototype.hasOwnProperty.call(params, key)) {
        path = path.replace(new RegExp(`:${key}`, 'g'), `/${params[key]}`);
      }
    }
  }
  // API endpoint must be separeted with _ symbol when constructed with with action name
  // therefore, we replace any _ with / to match the endpoint path
  return path.replace(/[_]{2}/g, '/');
}

/**
 * Creates a query function using the action definitions
 */
export function useHTTPActionQuery<T>(
  backend: RESTQueryFunc<T>,
  action: Action<RequestInterface>,
  config?: RequestsConfig
) {
  return () => {
    // eslint-disable-next-line prefer-const
    let { name, payload } = {
      ...action,
      payload: (action as Action<RequestInterface>).payload ?? {},
    };
    // eslint-disable-next-line prefer-const
    let { params, options, method, body } = payload;
    // We remove any `[` `]` from the starts and the end of the name string
    // to avoid any issue when parsing the name
    name = name.startsWith('[') ? name.substring(1) : name;
    name = (
      name.endsWith(']') ? name.substring(0, name.length - 1) : name
    ).trim();
    let path!: string;
    if (config && config.actions) {
      path =
        typeof config.actions[name] === 'string'
          ? (config.actions[name] as string)
          : (config.actions[name] as QueryConfigParamsType)!.path;
      method =
        method ??
        (typeof config.actions[name] === 'string'
          ? 'GET'
          : ((config.actions[name] as QueryConfigParamsType)!.method ?? 'GET'));
    }
    method =
      method ?? name.match(/^POST|PUT|PATCH|GET|DELETE|OPTIONS|HEAD/i)![0];
    if (method === null || typeof method === 'undefined') {
      throw new Error(
        'Request action name must be of type [method_endpoint:param1:param2]'
      );
    }
    // Get the request path from the request interface
    path = buildQueryPath(
      name,
      method,
      path ?? payload.path,
      params ?? options?.params ?? undefined,
      config
    );

    return backend(path, method ?? 'GET', body, {
      headers: options?.headers ?? {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      responseType: options?.responseType ?? 'json',
      params: options?.params || new Object(),
    });
  };
}
