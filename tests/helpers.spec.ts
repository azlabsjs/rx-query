import {
  interval,
  lastValueFrom,
  Observable,
  of,
  Subscription,
  take,
  tap,
} from 'rxjs';
import {
  Query,
  QueryProviderType,
  QueryState,
  observable,
  queryIsLoading,
  useQuery,
} from '../src';

import { ProvidesQuery } from '../src';
import { deepEqual } from '@azlabsjs/utilities';

@ProvidesQuery({
  observe: 'response',
  cacheTime: 3000,
})
export class TestQueryStateProvider
  implements QueryProviderType<[string, Record<string, unknown>]>
{
  query(path: string, params?: Record<string, unknown>) {
    return of({ path, params });
  }
}

function createResponse(response: Record<string, unknown>) {
  return new Promise((resolve) => resolve(response));
}

let executionCount = 0;
class MyClass {
  @Query(
    (path: string, method: string) => {
      executionCount = executionCount + 1;
      return createResponse({
        title: 'In publishing and graphic design',
        content: 'Lorem ipsum is a placeholder text commonly.',
        createdAt: '2022-11-20 18:20',
        path,
        method,
      });
    },
    'api/v1/books',
    'GET',
    {
      cacheQuery: true,
      staleTime: 2000,
      refetchInterval: 10000,
      cacheTime: 10_000,
      name: 'get_books_component',
      observe: 'response',
    }
  )
  private book$!: Observable<QueryState>;
  private subscription!: Subscription;
  private callCount: number = 0;
  private argument!: unknown;

  public onInit() {
    this.subscription = this.book$?.subscribe((response) => {
      this.argument = response;
      this.callCount++;
    });
  }

  public getCallCount() {
    return this.callCount;
  }

  public getCalledWith() {
    return this.argument;
  }

  public onDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }
}

describe('useQuery helper tests', () => {
  it('should invoke the query function and cache the query result', async () => {
    const query$ = observable<QueryState>(
      useQuery(
        (name: string, lastname: string) => {
          return of({ name, lastname });
        },
        'Sidoine',
        'Azandrew',
        {
          name: 'test_query_cache_key',
          cacheQuery: true,
        }
      )
    );
    query$
      .pipe(
        tap((value) => {
          if (queryIsLoading(value)) {
            expect(value.pending).toEqual(true);
            expect(value.response).toBeUndefined();
          } else {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect((value.response as any)?.name).toEqual('Sidoine');
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect((value.response as any)?.lastname).toEqual('Azandrew');
          }
        })
      )
      .subscribe();
    expect(true).toBe(true);
    await lastValueFrom(interval(2000).pipe(take(1)));
  });

  it('should call the query provider query method and cache the result', async () => {
    const query$ = useQuery(new TestQueryStateProvider(), '/api/v1/posts', {
      post_id: 20,
    });
    query$
      .pipe(
        tap((value) => {
          expect(value?.path).toEqual('/api/v1/posts');
          expect(value?.params).toEqual({
            post_id: 20,
          });
        })
      )
      .subscribe();
    expect(true).toBe(true);
    await lastValueFrom(interval(2000).pipe(take(1)));
  });

  it('should test  MyClass', async () => {
    const o = new MyClass();

    o.onInit();

    await new Promise<void>((resolve) => {
      const t = setTimeout(() => {
        o.onDestroy();
        expect(o.getCallCount()).toEqual(1);
        expect(
          deepEqual(o.getCalledWith(), {
            title: 'In publishing and graphic design',
            content: 'Lorem ipsum is a placeholder text commonly.',
            createdAt: '2022-11-20 18:20',
            path: 'api/v1/books',
            method: 'GET'
          })
        ).toBeTruthy();
        resolve();
        clearTimeout(t);
      }, 2000);
    });
  });
});
