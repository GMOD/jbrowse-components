// The ambient type for the `fetchMock` global that config/jest/fetchMockAfterEnv.js
// installs. Ours, because the mock is: jest-fetch-mock shipped its own
// `declare global` outside @types, an explicit `types` array in tsconfig never
// loaded it, and a cold typecheck reported 59 TS2304s that a warm one hid.

type MockedFetch = jest.Mock<
  Promise<Response>,
  [RequestInfo | URL, RequestInit?]
>

/** what `mockResponse` and friends accept: a body, or a responder given the request */
type MockResponseBody =
  | string
  | ((
      request: Request,
    ) => Promise<Response | string | { body?: string; status?: number }>)

interface FetchMock extends MockedFetch {
  /** respond to every call until changed */
  mockResponse(body: MockResponseBody, init?: ResponseInit): FetchMock
  /** respond to the next call only */
  mockResponseOnce(body: MockResponseBody, init?: ResponseInit): FetchMock
  /** queue one response per call, in order; each entry is a body or [body, init] */
  mockResponses(...responses: (string | [string, ResponseInit?])[]): FetchMock
  /** reject the next call */
  mockRejectOnce(error: Error | (() => Error)): FetchMock
  /** pass through to the real fetch until doMock() */
  dontMock(): FetchMock
  /** resume mocking after dontMock() */
  doMock(): FetchMock
  /** clear calls and queued responses, and re-arm the empty-200 default */
  resetMocks(): FetchMock
}

declare const fetchMock: FetchMock
