// The top-level import makes this file a module, so the `declare module` below
// is a module-augmentation (merge) rather than a standalone ambient declaration
// (replace), and it resolves jest-fetch-mock's real MockResponseInit type.
import type { MockResponseInit } from 'jest-fetch-mock'

// jest-fetch-mock types its callback form (`mockResponse(fn)`) to return only
// `string | MockResponseInit`, but at runtime it also accepts a real `Response`
// — which our mock handlers (generateReadBuffer/handleRequest) return. Merge an
// extra overload onto its FetchMock interface so the global `fetchMock` accepts
// Response-returning callbacks without per-call-site casts or suppressions.
type JBrowseMockResponse = string | MockResponseInit | Response
type JBrowseMockResponseFn = (
  request: Request,
) => JBrowseMockResponse | Promise<JBrowseMockResponse>

declare module 'jest-fetch-mock' {
  interface FetchMock {
    mockResponse(fn: JBrowseMockResponseFn): FetchMock
    mockResponseOnce(fn: JBrowseMockResponseFn): FetchMock
    once(fn: JBrowseMockResponseFn): FetchMock
  }
}
