import { isAuthNeededException } from '../types/data.ts'
import { openLocation } from './index.ts'

const URL = 'https://data.mylab.org/private/reads.bam'

beforeEach(() => {
  globalThis.fetch = jest.fn(async () => {
    return new Response('', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="x"' },
    })
  })
})

// RpcManager mints the HTTP Basic account off this error, and recognizes it by
// name on the far side of the worker boundary
test.each([
  ['read', (f: ReturnType<typeof openLocation>) => f.read(10, 0)],
  ['readFile', (f: ReturnType<typeof openLocation>) => f.readFile()],
  ['stat', (f: ReturnType<typeof openLocation>) => f.stat()],
])(
  'a 401 asking for HTTP Basic reaches the caller of %s as an auth prompt',
  async (_name, run) => {
    const error = await run(
      openLocation({ uri: URL, locationType: 'UriLocation' }),
    ).catch((e: unknown) => e)
    expect(isAuthNeededException(error)).toBe(true)
    expect(error).toMatchObject({ url: URL })
  },
)
