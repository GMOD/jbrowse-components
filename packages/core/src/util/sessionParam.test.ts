import { urlParamNames } from './analytics.ts'
import { pageUrlParams } from './sessionParam.ts'

test('a share link keeps its params in the hash, and they are read from there', () => {
  const url = new URL(
    'https://jbrowse.org/code/jb2/main/?stale=1#config=c.json&session=share-abc',
  )
  expect(pageUrlParams(url).get('session')).toBe('share-abc')
  expect(pageUrlParams(url).get('stale')).toBeNull()
  expect(urlParamNames(pageUrlParams(url))).toBe('config,session')
})

test('a URL whose hash holds no params is read from its query string', () => {
  const url = new URL('https://jbrowse.org/jb2/?config=c.json&loc=chr1#top')
  expect(urlParamNames(pageUrlParams(url))).toBe('config,loc')
})
