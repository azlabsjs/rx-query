/**
 * @jest-environment jsdom
 */

import { createCache } from '../src';
import { Cache, TypeDef } from '../src/caching';
import { guid } from '../src/queries';
import { deepEqual } from '@azlabsjs/utilities';

describe('caching test', () => {
  let cache!: Cache<TypeDef>;

  beforeEach(() => {
    cache = createCache<TypeDef>();
  });

  it('should create an instance of Cache class', () => {
    expect(cache).toBeTruthy();
    expect(cache).toBeInstanceOf(Cache);
  });

  it('should test add QueriesCache.add() method and expect cache length to grow by the size of 1', () => {
    cache.add({
      id: guid(),
      argument: [],
    });
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

    const req = {
      id: guid(),
      argument: ['get_api/v1/comments:post_id', payload],
    };
    const req2 = {
      id: guid(),
      argument: [],
    };

    // add items to cache
    cache.add(req);
    cache.add(req2);

    const param = {
      argument: [
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
      ],
    };
    const search = (x: TypeDef) => deepEqual(x.argument, param.argument);
    const result = cache.get(search);
    expect(result).toEqual(req);
  });

  it('should add a value to the cache an retrieve it using request id', () => {
    const objecId = guid();
    const objectid2 = guid();
    const objecId3 = guid();
    cache.add({
      id: objecId,
      argument: ['GET', 'api/users'],
    });

    cache.add({
      id: objectid2,
      argument: ['GET', 'api/users'],
    });

    const result = cache.get((x) => x.id === objecId);
    const result2 = cache.get((x) => x.id === objectid2);
    const result3 = cache.get((x) => x.id === objecId3);

    expect(result?.id).toEqual(objecId);
    expect(result2?.id).toEqual(objectid2);
    expect(result3).toBeUndefined();
  });

  it('should test if the cache is empty when clear() is called', () => {
    const objecId = guid();
    const objectid2 = guid();
    cache.add({
      id: objecId,
      argument: ['GET', 'api/users'],
    });
    cache.add({
      id: objectid2,
      argument: ['GET', 'api/users'],
    });
    expect(cache.length).toEqual(2);
    cache.clear();
    expect(cache.length).toEqual(0);
    expect(cache.isEmpty()).toEqual(true);
  });

  it('should return false when .has() is called a cache item that has been removed', () => {
    const objecId = guid();
    const objectid2 = guid();
    cache.add({
      id: objecId,
      argument: ['GET', 'api/users'],
    });
    cache.add({
      id: objectid2,
      argument: ['GET', 'api/users'],
    });
    const search = (x: TypeDef) => x.id === objectid2;
    expect(cache.has(search)).toEqual(true);
    cache.remove(search);
    expect(cache.has(search)).toEqual(false);
  });
});
