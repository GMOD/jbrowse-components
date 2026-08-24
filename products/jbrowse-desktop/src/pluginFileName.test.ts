import path from 'node:path'

import { pluginFileName } from './util.tsx'

test('the url basename is the filename', () => {
  expect(pluginFileName('https://example.com/plugin.js')).toBe('plugin.js')
  expect(pluginFileName('https://example.com/dist/index.js')).toBe('index.js')
})

test('query and hash are not part of the name', () => {
  expect(pluginFileName('https://example.com/plugin.js?v=2')).toBe('plugin.js')
  expect(pluginFileName('https://example.com/plugin.js#x')).toBe('plugin.js')
})

test('a url naming a directory falls back rather than using the host', () => {
  expect(pluginFileName('https://example.com/')).toBe('plugin.js')
  expect(pluginFileName('https://example.com/dist/')).toBe('plugin.js')
})

test('nothing that could leave the temp directory survives', () => {
  expect(pluginFileName('https://example.com/..')).toBe('plugin.js')
  expect(pluginFileName('https://example.com/.')).toBe('plugin.js')
  expect(pluginFileName('https://example.com/a/../../etc/passwd')).toBe(
    'passwd',
  )
})

test('the result is always a single writable segment', () => {
  const urls = [
    'https://example.com/we%2Fird.js',
    'https://example.com/sp ace.js',
    'https://example.com',
    'https://example.com/\\\\windows\\\\style.js',
    `https://example.com/${'a'.repeat(500)}.js`,
    'not a url at all',
  ]
  for (const url of urls) {
    const name = pluginFileName(url)
    expect(name).toBeTruthy()
    expect(name.length).toBeLessThanOrEqual(200)
    expect(path.join('/tmp/dir', name).startsWith('/tmp/dir/')).toBe(true)
  }
})
