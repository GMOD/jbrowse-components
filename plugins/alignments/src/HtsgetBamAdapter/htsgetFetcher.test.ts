import { getFetcher } from '@jbrowse/core/util/io'

import { htsgetFetcher } from './HtsgetBamAdapter.ts'

jest.mock('@jbrowse/core/util/io', () => ({
  ...jest.requireActual('@jbrowse/core/util/io'),
  getFetcher: jest.fn(),
}))

const BASE = 'https://htsget.example.com/reads/'

const authorized = jest.fn(async () => new Response())
const plain = jest.fn(async () => new Response())

beforeEach(() => {
  jest.mocked(getFetcher).mockReturnValue(authorized)
  authorized.mockClear()
  plain.mockClear()
  globalThis.fetch = plain
})

test('the ticket request carries the endpoint credential', async () => {
  await htsgetFetcher(BASE)(`${BASE}NA12878?format=BAM`)
  expect(authorized).toHaveBeenCalledTimes(1)
  expect(plain).not.toHaveBeenCalled()
})

// The ticket names where the blocks live, and that can be anywhere. The account
// fetcher signs whatever url it is handed, so an unscoped one would hand the
// endpoint's token to this host.
test('a data block on another origin is fetched without the credential', async () => {
  await htsgetFetcher(BASE)('https://blocks.cdn.example.net/chunk/0')
  expect(plain).toHaveBeenCalledTimes(1)
  expect(authorized).not.toHaveBeenCalled()
})

test('the scope is the origin, not a prefix of the base url', async () => {
  await htsgetFetcher(BASE)('https://htsget.example.com.evil.test/chunk/0')
  expect(plain).toHaveBeenCalledTimes(1)
  expect(authorized).not.toHaveBeenCalled()
})

test('a Request input is scoped by its own url', async () => {
  await htsgetFetcher(BASE)(
    new Request('https://elsewhere.example.net/chunk/0'),
  )
  expect(plain).toHaveBeenCalledTimes(1)
  expect(authorized).not.toHaveBeenCalled()
})

test('an unparseable url is treated as foreign', async () => {
  await htsgetFetcher(BASE)('/relative/chunk/0')
  expect(plain).toHaveBeenCalledTimes(1)
  expect(authorized).not.toHaveBeenCalled()
})

test('a different port is a different origin', async () => {
  await htsgetFetcher(BASE)('https://htsget.example.com:8443/reads/x')
  expect(plain).toHaveBeenCalledTimes(1)
  expect(authorized).not.toHaveBeenCalled()
})
