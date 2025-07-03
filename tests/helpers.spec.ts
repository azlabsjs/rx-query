import { interval, lastValueFrom, of, take, tap } from 'rxjs';
import {
  QueryProviderType,
  QueryState,
  observable,
  queryIsLoading,
  useQuery,
} from '../src';

import { ProvidesQuery } from '../src';

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
});
