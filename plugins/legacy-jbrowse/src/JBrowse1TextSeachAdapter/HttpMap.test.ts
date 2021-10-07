import path from 'path'
import meta from '../../test_data/names/meta.json'
import first from '../../test_data/names/0.json'
import last from '../../test_data/names/f.json'
import HttpMap from './HttpMap'

describe('test JBrowse1 hash implementation', () => {
  test('read from meta', async () => {
    function mockFetch(url: string): Promise<Response> {
      let response = {}
      if (url.includes('names/meta.json')) {
        response = meta
      }
      return Promise.resolve(new Response(JSON.stringify(response)))
    }
    const rootTemplate = path
      .join(__dirname, '..', '..', '..', '..', 'test_data', 'names')
      .replace(/\\/g, '\\\\')

    const spy = jest.spyOn(global, 'fetch')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    spy.mockImplementation(mockFetch as any)
    const hashMap = new HttpMap({
      url: rootTemplate,
    })

    await hashMap.getBucket('apple')

    // test compress and hash hex characters are set after initial search
    expect(await hashMap.getHashHexCharacters()).toBe(1)
    expect(await hashMap.getCompress()).toBe(0)
  })
  test('get bucket contents', async () => {
    function mockFetch(url: string): Promise<Response> {
      let response = {}
      if (url.includes('names/meta.json')) {
        response = meta
      }
      if (url.includes('names/0.json')) {
        response = first
      }
      if (url.includes('names/f.json')) {
        response = last
      }
      return Promise.resolve(new Response(JSON.stringify(response)))
    }
    const rootTemplate = path
      .join(__dirname, '..', '..', '..', '..', 'test_data', 'names')
      .replace(/\\/g, '\\\\')

    const spy = jest.spyOn(global, 'fetch')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    spy.mockImplementation(mockFetch as any)
    const hashMap = new HttpMap({
      url: rootTemplate,
    })

    await hashMap.getBucket('apple')
    expect(spy).toHaveBeenLastCalledWith(`${rootTemplate}/0.json`)

    await hashMap.getBucket('apple3')
    expect(spy).toHaveBeenLastCalledWith(`${rootTemplate}/f.json`)
  })
})
