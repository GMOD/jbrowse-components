/// <reference types="jest" />
/// <reference types="jest" />

interface FetchMock extends jest.Mock {
  mockResponse: (fn: (request: Request) => Promise<Response>) => void
  resetMocks: () => void
  mockReject: (fn: () => Promise<Error>) => void
  mockResponseOnce: (fn: (request: Request) => Promise<Response>) => void
  mockRejectOnce: (fn: () => Promise<Error>) => void
}

declare global {
  const fetch: FetchMock
}

export {}

interface FetchMock extends jest.Mock {
  mockResponse: (fn: (request: Request) => Promise<Response>) => void
  resetMocks: () => void
  mockReject: (fn: () => Promise<Error>) => void
  mockResponseOnce: (fn: (request: Request) => Promise<Response>) => void
  mockRejectOnce: (fn: () => Promise<Error>) => void
}

declare global {
  const fetch: FetchMock
}

export {}
