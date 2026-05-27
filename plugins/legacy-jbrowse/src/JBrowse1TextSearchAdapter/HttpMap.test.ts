import path from 'path'

import HttpMap from './HttpMap.ts'
import first from '../../test_data/names/0.json' with { type: 'json' }
import last from '../../test_data/names/f.json' with { type: 'json' }
import meta from '../../test_data/names/meta.json' with { type: 'json' }

const rootTemplate = path
  .join(__dirname, '..', '..', '..', '..', 'test_data', 'names')
  .replaceAll('\\', '\\\\')

beforeEach(() => {
  jest.clearAllMocks()
})

function mockFetch(url: string | Request | URL) {
  let response: object = {}
  if (`${url}`.includes('names/meta.json')) {
    response = meta
  } else if (`${url}`.includes('names/0.json')) {
    response = first
  } else if (`${url}`.includes('names/f.json')) {
    response = last
  }
  return Promise.resolve(new Response(JSON.stringify(response)))
}

test('read from meta', async () => {
  jest.spyOn(global, 'fetch').mockImplementation(mockFetch)
  const hashMap = new HttpMap({ url: rootTemplate })
  await hashMap.getBucket('apple')

  expect(await hashMap.getHashHexCharacters()).toBe(1)
  expect(await hashMap.getCompress()).toBe(0)
})

test('meta.json is only fetched once across multiple accessors', async () => {
  const spy = jest.spyOn(global, 'fetch').mockImplementation(mockFetch)
  const hashMap = new HttpMap({ url: rootTemplate })

  await hashMap.getHashHexCharacters()
  await hashMap.getCompress()
  await hashMap.getTrackNames()

  const metaCalls = spy.mock.calls.filter(([url]) =>
    `${url}`.includes('meta.json'),
  )
  expect(metaCalls).toHaveLength(1)
})

test('get bucket contents', async () => {
  const spy = jest
    .spyOn(global, 'fetch')
    .mockImplementation(mockFetch)
  const hashMap = new HttpMap({ url: rootTemplate })

  await hashMap.getBucket('apple')
  expect(spy).toHaveBeenLastCalledWith(`${rootTemplate}/0.json`, undefined)

  await hashMap.getBucket('apple3')
  expect(spy).toHaveBeenLastCalledWith(`${rootTemplate}/f.json`, undefined)
})

test('url always has trailing slash', () => {
  const withSlash = new HttpMap({ url: 'http://example.com/names/' })
  const withoutSlash = new HttpMap({ url: 'http://example.com/names' })
  expect(withSlash.url).toBe('http://example.com/names/')
  expect(withoutSlash.url).toBe('http://example.com/names/')
})

test('hash returns lowercase hex with no hyphens', () => {
  const map = new HttpMap({ url: 'http://example.com/' })
  const h = map.hash('test')
  expect(h).toMatch(/^[0-9a-f]+$/)
})
