/**
 * @jest-environment jsdom
 */
import {
  first,
  firstValueFrom,
  forkJoin,
  interval,
  lastValueFrom,
  of,
  tap,
  timer,
} from 'rxjs';
import { cachedQuery, invalidateQuery } from '../src';
import { Requests } from '../src/base';

describe('Cached request class cache tests', () => {
  let defaultWindow = window;

  beforeEach(async () => {});

  it('should test whether the window object is present in a testing environment', () => {
    expect(defaultWindow).toBeTruthy();
  });

  it('It should run the request 2 times, before 2000 ms given a refetchInterval of 700 ms', async () => {
    let resultCallCounts = 0;
    let resultState!: number[];
    const argument = () => {
      return new Promise<number[]>((resolve) => {
        resolve([1, 2, 3, 4]);
      });
    };
    const request = cachedQuery({
      argument,
      objectid: Requests.guid(),
      callback: argument,
      refetchCallback: (state) => {
        resultCallCounts = resultCallCounts + 1;
        resultState = state as number[];
      },
      properties: {
        refetchInterval: 700,
        retries: (attempts, error) => {
          return attempts < 3 || error !== 'Server Error';
        },
      },
      view: defaultWindow,
    });

    await lastValueFrom(interval(2000).pipe(first()));
    // Destroy the cached request
    request.destroy();
    expect(resultCallCounts).toEqual(2);
    expect(resultState).toEqual([1, 2, 3, 4]);
  });

  it('should not try more than 4 times on error', async () => {
    const argument = () => {
      return new Promise<number[]>((_, reject) => {
        reject('Server Error');
      });
    };
    const request = cachedQuery({
      objectid: Requests.guid(),
      argument,
      callback: argument,
      refetchCallback: () => {
        //
      },
      properties: {
        retries: (attempts, error) => {
          return attempts < 3 || error !== 'Server Error';
        },
      },
      lastError: new Error('Server Error Occured!'),
    });

    await lastValueFrom(interval(2000).pipe(first()));
    request.destroy();
    expect((request as any).retryState.tries).toEqual(2);
    expect((request as any).retryState.lastError).toEqual('Server Error');
  });

  it('should not invoke the background request when the request is not mark as stale', async () => {
    const payload = () => {
      return new Promise<string>((resolve) => {
        resolve('Response from server');
      });
    };
    let refetchCount = 0;
    const request = cachedQuery({
      objectid: Requests.guid(),
      callback: payload,
      refetchCallback: () => {
        refetchCount = refetchCount + 1;
      },
      properties: {
        refetchInterval: 500,
        retries: 3,
        staleTime: 1000,
      },
    });
    await lastValueFrom(interval(2000).pipe(first()));
    request.destroy();
    expect(refetchCount).toEqual(1);
  });

  //
  it('should not call refetch callback when Infinity is passed as refetchInterval', async () => {
    let requestRefetchCount = 0;
    let request2RefetchCount = 0;
    const request = cachedQuery({
      objectid: Requests.guid(),
      callback: () => {
        return of('Called async action...');
      },
      refetchCallback: () => {
        requestRefetchCount++;
      },
      properties: {
        refetchInterval: Infinity,
      },
    });

    const request2 = cachedQuery({
      objectid: Requests.guid(),
      callback: () => {
        return of('Called async action...');
      },
      refetchCallback: () => {
        request2RefetchCount++;
      },
      properties: {
        refetchInterval: 500,
      },
    });

    await lastValueFrom(interval(2000).pipe(first()));
    request.destroy();
    request2.destroy();
    expect(requestRefetchCount).toEqual(0);
    expect(request2RefetchCount).toBeGreaterThan(0);
  });

  //
  it('should not call refetch callback when number less than 0 is passed as refetchInterval', async () => {
    let requestRefetchCount = 0;
    let request2RefetchCount = 0;
    const request = cachedQuery({
      objectid: Requests.guid(),
      callback: () => {
        return of('Called async action...');
      },
      refetchCallback: () => {
        requestRefetchCount++;
      },
      properties: {
        refetchInterval: -1,
      },
    });

    const request2 = cachedQuery({
      objectid: Requests.guid(),
      callback: () => {
        return of('Called async action...');
      },
      refetchCallback: () => {
        request2RefetchCount++;
      },
      properties: {
        refetchInterval: 500,
      },
    });

    await lastValueFrom(interval(2000).pipe(first()));
    request.destroy();
    request2.destroy();
    expect(requestRefetchCount).toEqual(0);
    expect(request2RefetchCount).toEqual(3);
  });

  it('should not call fetchCallback if item is invalidated, will call refetch only once', async () => {
    let requestRefetchCount = 0;
    const request = cachedQuery({
      objectid: Requests.guid(),
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

    await firstValueFrom(
      forkJoin([
        timer(1500).pipe(tap(() => invalidateQuery(request))),
        timer(3000),
      ]).pipe(
        tap(() => {
          expect(requestRefetchCount).toEqual(1);
        })
      )
    );
  });
});
