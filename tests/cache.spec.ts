/**
 * @jest-environment jsdom
 */

import { of } from 'rxjs';
import { cacheRequest, requestsCache } from '../src';
import { Requests } from '../src/base';
import { CachedRequest, RequestsCache } from '../src/caching';

describe('Requests cache test', () => {
  let cache!: RequestsCache;

  beforeEach(() => {
    cache = requestsCache();
  });

  it('should create an instance of Cache class', () => {
    expect(cache).toBeTruthy();
    expect(cache).toBeInstanceOf(RequestsCache);
  });

  it('should test add RequestsCache.add() method and expect cache length to grow by the size of 1', () => {
    cache.add(
      cacheRequest({
        objectid: Requests.guid(),
        callback: () => of('Server Response'),
        properties: true,
        refetchCallback: () => {},
      })
    );
    expect(cache.length).toBe(1);
  });

  it('should add a value to the cache an retrieve it using the payload value', () => {
    const payload = {
      method: 'GET',
      body: {
        _query: JSON.stringify({
          where: [
            ['firstname', 'like', 'Az%'],
            ['lastname', 'like', '%Sidoine%'],
          ],
        }),
      },
      params: {
        post_id: 23,
      },
    };
    cache.add(
      cacheRequest({
        objectid: Requests.guid(),
        callback: () => of('Server Response'),
        properties: true,
        refetchCallback: () => {},
        argument: ['get_api/v1/comments:post_id', payload],
      })
    );
    cache.add(
      cacheRequest({
        objectid: Requests.guid(),
        callback: () => of('Server Response'),
        properties: true,
        refetchCallback: () => {},
      })
    );
    const result = cache.at(
      cache.indexOf([
        'get_api/v1/comments:post_id',
        {
          method: 'GET',
          body: {
            _query: JSON.stringify({
              where: [
                ['firstname', 'like', 'Az%'],
                ['lastname', 'like', '%Sidoine%'],
              ],
            }),
          },
          params: {
            post_id: 23,
          },
        },
      ])
    );
    expect(result).toBeInstanceOf(CachedRequest);
  });

  it('should add a value to the cache an retrieve it using request id', () => {
    const objecId = Requests.guid();
    const objectid2 = Requests.guid();
    cache.add(
      cacheRequest({
        objectid: objecId,
        callback: () => of('Server Response'),
        properties: true,
        refetchCallback: () => {},
      })
    );
    cache.add(
      cacheRequest({
        objectid: objectid2,
        callback: () => of('Server Response 2'),
        properties: true,
        refetchCallback: () => {},
      })
    );
    const result = cache.at(cache.indexOf(objecId));
    const result2 = cache.at(cache.indexOf(objectid2));
    expect(result).toBeInstanceOf(CachedRequest);
    expect(result2).toBeInstanceOf(CachedRequest);
  });

  it('should return false if cache does not contains a given key else it returns true', () => {
    const objectid = Requests.guid();
    const objectid2 = Requests.guid();
    cache.add(
      cacheRequest({
        objectid,
        callback: () => of('Server Response'),
        properties: true,
        refetchCallback: () => {},
        argument: 'Hello World!',
      })
    );
    cache.add(
      cacheRequest({
        objectid: objectid2,
        callback: () => of('Server Response 2'),
        properties: true,
        refetchCallback: () => {},
      })
    );
    expect(cache.contains(Requests.guid())).toEqual(false);
    expect(cache.contains('Hello World!')).toEqual(true);
    expect(cache.contains(objectid)).toEqual(true);
  });

  it('should test if the cache is empty when clear() is called', () => {
    const objectid = Requests.guid();
    cache.add(
      cacheRequest({
        objectid,
        callback: () => of('Server Response'),
        properties: true,
        refetchCallback: () => {},
      })
    );
    expect(cache.length).toEqual(1);
    cache.clear();
    expect(cache.length).toEqual(0);
    expect(cache.isEmpty()).toEqual(true);
  });

  it('should return false when RequestsCache.contains() is called a cache item that has been removed', () => {
    const objectid = Requests.guid();
    const objectid2 = Requests.guid();
    cache.add(
      cacheRequest({
        objectid,
        callback: () => of('Server Response 1'),
        properties: true,
        refetchCallback: () => {},
        argument: 'Hello World!',
      })
    );
    cache.add(
      cacheRequest({
        objectid: objectid2,
        callback: () => of('Server Response'),
        properties: true,
        refetchCallback: () => {},
      })
    );

    cache.removeAt(cache.indexOf('Hello World!'));
    expect(cache.length).toEqual(1);
    expect(cache.get('Hello World!')).toBeUndefined();
    expect(cache.contains(objectid2)).toEqual(true);
  });
});
