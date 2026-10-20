import fs from 'node:fs'
import path from 'node:path'

import { prefetchConfig, takePrefetchedConfig } from './prefetchConfig.ts'

const html = fs.readFileSync(
  path.join(__dirname, '../public/index.html'),
  'utf8',
)
const script = /<script id="early-config">([\s\S]*?)<\/script>/.exec(html)![1]!

// global scope, as the browser runs a classic script
const runHtmlScript = () => {
  // eslint-disable-next-line no-eval
  ;(0, eval)(script)
}

const fetchMock = jest.fn()
let config: unknown

beforeEach(() => {
  config = { assemblies: [] }
  fetchMock.mockReset()
  fetchMock.mockImplementation(async () => ({
    ok: true,
    json: async () => config,
  }))
  global.fetch = fetchMock
  window.__jbrowseEarlyConfig = undefined
  window.__jbrowseConfigPath = undefined
  window.__jbrowseCacheBuster = undefined
  document.head.replaceChildren()
  document.body.replaceChildren()
})

const load = (url: string) => {
  window.history.replaceState(null, '', url)
}

test.each([
  ['/', 'config.json'],
  ['/?config=data/config.json', 'data/config.json'],
  ['/#config=hash/config.json&loc=chr1', 'hash/config.json'],
  ['/?config=search.json#notparams', 'search.json'],
  ['/?config=search.json#config=hash.json', 'hash.json'],
])('the HTML and main.js request one config for %s', async (url, expected) => {
  load(url)
  runHtmlScript()
  prefetchConfig()
  expect(fetchMock.mock.calls).toEqual([[expected]])
  expect(await takePrefetchedConfig(expected)).toEqual(config)
})

test('the host page global names the config', async () => {
  load('/')
  window.__jbrowseConfigPath = 'elsewhere.json'
  runHtmlScript()
  prefetchConfig()
  expect(fetchMock.mock.calls).toEqual([['elsewhere.json']])
})

test('a host page setting its config path after the script costs one more fetch', async () => {
  load('/')
  runHtmlScript()
  window.__jbrowseConfigPath = 'late.json'
  prefetchConfig()
  expect(fetchMock.mock.calls.map(c => c[0])).toEqual([
    'config.json',
    'late.json',
  ])
  expect(await takePrefetchedConfig('late.json')).toEqual(config)
})

test('config=none fetches nothing', () => {
  load('/?config=none')
  runHtmlScript()
  prefetchConfig()
  expect(fetchMock).not.toHaveBeenCalled()
})

test('the cache-buster leaves the request to main.js', () => {
  load('/')
  window.__jbrowseCacheBuster = true
  runHtmlScript()
  prefetchConfig()
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(fetchMock.mock.calls[0][0]).toMatch(/^config\.json\?rand=/)
})

test('a failed or unparseable response leaves the loader to fetch and report it', async () => {
  load('/')
  fetchMock.mockImplementation(async () => ({
    ok: true,
    json: async () => {
      throw new SyntaxError('bad json')
    },
  }))
  runHtmlScript()
  prefetchConfig()
  expect(await takePrefetchedConfig('config.json')).toBeUndefined()

  fetchMock.mockImplementation(async () => ({ ok: false }))
  runHtmlScript()
  prefetchConfig()
  expect(await takePrefetchedConfig('config.json')).toBeUndefined()
})

const preloads = () =>
  [...document.head.querySelectorAll('link[rel="preload"]')].map(l =>
    l.getAttribute('href'),
  )

const listChunks = (chunks: string[]) => {
  document.head.insertAdjacentHTML(
    'beforeend',
    `<script type="application/json" id="plugin-registry-chunks">${JSON.stringify(chunks)}</script>`,
  )
}

test('a config naming plugins preloads the registry chunks', async () => {
  config = { plugins: [{ name: 'P', url: 'p.js' }] }
  load('/')
  runHtmlScript()
  listChunks(['static/js/1.js', 'static/js/2.js'])
  await window.__jbrowseEarlyConfig!.config
  await Promise.resolve()
  expect(preloads()).toEqual(['static/js/1.js', 'static/js/2.js'])
})

test('a config naming no plugins preloads nothing', async () => {
  load('/')
  runHtmlScript()
  listChunks(['static/js/1.js'])
  await window.__jbrowseEarlyConfig!.config
  await Promise.resolve()
  expect(preloads()).toEqual([])
})
