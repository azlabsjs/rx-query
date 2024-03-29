/**
 * @jest-environment jsdom
 */

import { firstValueFrom, forkJoin, of, tap, timer } from 'rxjs';
import { cachedQuery, queriesCache } from '../src';
import { Requests } from '../src/base';
import { CachedQuery, QueriesCache } from '../src/caching';

describe('Requests cache test', () => {
  let cache!: QueriesCache;

  beforeEach(() => {
    cache = queriesCache();
  });

  it('should create an instance of Cache class', () => {
    expect(cache).toBeTruthy();
    expect(cache).toBeInstanceOf(QueriesCache);
  });

  it('should test add QueriesCache.add() method and expect cache length to grow by the size of 1', () => {
    cache.add(
      cachedQuery({
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
      cachedQuery({
        objectid: Requests.guid(),
        callback: () => of('Server Response'),
        properties: true,
        refetchCallback: () => {},
        argument: ['get_api/v1/comments:post_id', payload],
      })
    );
    cache.add(
      cachedQuery({
        objectid: Requests.guid(),
        callback: () => of('Server Response'),
        properties: true,
        refetchCallback: () => {},
      })
    );
    const result = cache.get([
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
    ]);
    expect(result).toBeInstanceOf(CachedQuery);
  });

  it('should add a value to the cache an retrieve it using request id', () => {
    const objecId = Requests.guid();
    const objectid2 = Requests.guid();
    cache.add(
      cachedQuery({
        objectid: objecId,
        callback: () => of('Server Response'),
        properties: true,
        refetchCallback: () => {},
      })
    );
    cache.add(
      cachedQuery({
        objectid: objectid2,
        callback: () => of('Server Response 2'),
        properties: true,
        refetchCallback: () => {},
      })
    );
    const result = cache.get(objecId);
    const result2 = cache.get(objectid2);
    expect(result).toBeInstanceOf(CachedQuery);
    expect(result2).toBeInstanceOf(CachedQuery);
  });

  it('should return false if cache does not contains a given key else it returns true', () => {
    const objectid = Requests.guid();
    const objectid2 = Requests.guid();
    cache.add(
      cachedQuery({
        objectid,
        callback: () => of('Server Response'),
        properties: true,
        refetchCallback: () => {},
        argument: 'Hello World!',
      })
    );
    cache.add(
      cachedQuery({
        objectid: objectid2,
        callback: () => of('Server Response 2'),
        properties: true,
        refetchCallback: () => {},
      })
    );
    expect(cache.has(Requests.guid())).toEqual(false);
    expect(cache.has('Hello World!')).toEqual(true);
    expect(cache.has(objectid)).toEqual(true);
  });

  it('should test if the cache is empty when clear() is called', () => {
    const objectid = Requests.guid();
    cache.add(
      cachedQuery({
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

  it('should return false when QueriesCache.contains() is called a cache item that has been removed', () => {
    const objectid = Requests.guid();
    const objectid2 = Requests.guid();
    cache.add(
      cachedQuery({
        objectid,
        callback: () => of('Server Response 1'),
        properties: true,
        refetchCallback: () => {},
        argument: 'Hello World!',
      })
    );
    cache.add(
      cachedQuery({
        objectid: objectid2,
        callback: () => of('Server Response'),
        properties: true,
        refetchCallback: () => {},
      })
    );

    cache.remove('Hello World!');
    expect(cache.length).toEqual(1);
    expect(cache.get('Hello World!')).toBeUndefined();
    expect(cache.has(objectid2)).toEqual(true);
  });

  it('should not call fetchCallback if item is invalidated and remove item from cache', async () => {
    let requestRefetchCount = 0;
    const objectid = Requests.guid();
    const request = cachedQuery({
      objectid,
      callback: () => {
        return of('Called async action...');
      },
      refetchCallback: () => {
        requestRefetchCount++;
      },
      properties: {
        refetchInterval: 1000,
      },
    });
    cache.add(request);

    await firstValueFrom(
      forkJoin([
        timer(1500).pipe(
          tap(() => {
            cache.invalidate(objectid);
          })
        ),
        timer(3000),
      ]).pipe(
        tap(() => {
          expect(cache.get(objectid)).toBeUndefined();
          expect(requestRefetchCount).toEqual(1);
        })
      )
    );
  });
});
