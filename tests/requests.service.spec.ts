/**
 * @jest-environment jsdom
 */

import {
  ObservableInput,
  filter,
  first,
  interval,
  lastValueFrom,
  map,
  of,
  tap,
  throwError,
} from 'rxjs';
import { Requests } from '../src/base';
import { apiResponse, firstWhere } from '../src/rx';
import { useHTTPActionQuery } from './helpers';

const testResult = {
  data: [
    {
      title: 'Lorem Ipsum',
      description:
        "Le lorem ipsum est, en imprimerie, une suite de mots sans signification utilisée à titre provisoire pour calibrer une mise en page, le texte définitif venant remplacer le faux-texte dès qu'il est prêt ou que la mise en page est achevée.",
    },
  ],
};

const commentResult = {
  data: [
    {
      title: 'It is a long established',
      postId: 1,
      value:
        'It is a long established fact that a reader will be distracted by the readable content of a page when looking at its layout. The point of using Lorem Ipsum is that it has a more-or-less normal distribution of letters',
    },
    {
      title: 'Many desktop',
      postId: 1,
      value:
        'Many desktop publishing packages and web page editors now use Lorem Ipsum as their default model text, and a search for lorem ipsum will uncover many web sites still in their infancy',
    },
  ],
};

const fnTestResult = {
  content: '/Users/azandrewsidoine/Documents/creative-scala.pdf',
  description: 'SCALA PROGRAMMING LANGUAGE EBOOK 2',
};

const queryBackend = (path: string) => {
  if (path.includes('comments')) {
    return throwError(() => 'Comments path not supported');
  }
  return (
    path.includes('comments') ? of(commentResult) : of(testResult)
  ) as ObservableInput<any>;
};

describe('Requests', () => {
  let service!: Requests;

  beforeEach(() => {
    service = new Requests();
  });

  it('should create the request service', async () => {
    expect(service).toBeTruthy();
  });

  it('should handle request and log the request to cache', async () => {
    const query$ = useHTTPActionQuery(queryBackend, {
      name: '[get_api/v1/posts:post_id/users:user_id/post_user:user_id',
      payload: {
        body: {
          _query: {
            where: ['id', 'dh356-hdfg53-fgnr67-fghg68'],
          },
        },
        params: {
          user_id: 2,
          post_id: 1032,
        },
        options: {
          headers: {
            'Content-Type': 'application/json',
            Accept: '*/*',
          },
          responseType: 'json',
        },
      },
    });
    service
      .select(service.dispatch(query$))
      .pipe(
        filter((state) => state.pending === false),
        map((state) => {
          expect(state.response).toEqual(testResult);
        })
      )
      .subscribe();

    service
      .select(
        service.dispatch(
          useHTTPActionQuery(queryBackend, {
            name: '[get_api/v1/post/:post_id/comments]',
            payload: {
              params: {
                post_id: 1,
              },
              options: {
                responseType: 'json',
              },
            },
          })
        )
      )
      .pipe(
        firstWhere((state) => state.pending === false),
        map((state) => {
          expect(state.response).toEqual(undefined);
          expect(state.error).toEqual('Comments path not supported');
        })
      )
      .subscribe();

    await lastValueFrom(interval(3000).pipe(first()));
  });

  it('should call the provider function passed as parameter and update the requests state with the result of the function call', async () => {
    service
      .select(
        service.dispatch(
          (path: string, method: string) => {
            console.log(path, method);
            return of(fnTestResult);
          },
          'api/v1/books',
          'GET'
        )
      )
      .pipe(
        apiResponse(),
        map((response) => {
          expect(response).toEqual(fnTestResult);
        })
      )
      .subscribe();

    await lastValueFrom(interval(3000).pipe(first()));
  });

  it('should cache the request and return the cached value to the client unless the request is mark as stale', async () => {
    const createResponse = (response: Record<string, unknown>) =>
      new Promise((resolve) => resolve(response));
    let executionCount = 0;
    service
      .select(
        service.dispatch(
          (path: string, method: string) => {
            console.log(path, method);
            executionCount = executionCount + 1;
            return createResponse({
              title: 'In publishing and graphic design',
              content:
                'Lorem ipsum is a placeholder text commonly used to demonstrate the visual form of a document or a typeface without relying on meaningful content. Lorem ipsum may be used as a placeholder before final copy is available',
              createdAt: '2022-11-20 18:20',
            });
          },
          'api/v1/books',
          'GET',
          {
            cacheQuery: true,
            staleTime: 2000,
            refetchInterval: 100,
            name: 'get_books_component',
          }
        )
      )
      .pipe(apiResponse())
      .subscribe();
    service
      .select(
        service.dispatch(
          (path: string, method: string) => {
            console.log(path, method);
            executionCount = executionCount + 1;
            return createResponse({
              title: 'In publishing and graphic design',
              content:
                'Lorem ipsum is a placeholder text commonly used to demonstrate the visual form of a document or a typeface without relying on meaningful content. Lorem ipsum may be used as a placeholder before final copy is available',
              createdAt: '2022-11-20 18:20',
            });
          },
          'api/v1/books',
          'GET',
          {
            cacheQuery: true,
            staleTime: 2000,
            refetchInterval: 100,
            name: 'get_books_component',
          }
        )
      )
      .pipe(apiResponse())
      .subscribe();
    return await lastValueFrom(
      interval(3000).pipe(
        first(),
        tap(() => {
          expect(executionCount).toEqual(2);
        })
      )
    );
  });
});
