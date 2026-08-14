import {
  arePluginsRemembered,
  forgetTrustedPlugins,
  listTrustedPlugins,
  rememberPlugins,
} from './trustedPlugins.ts'

import type { PluginDefinition } from '@jbrowse/core/pluginDefinitions'

const apollo: PluginDefinition = {
  name: 'Apollo',
  url: 'http://localhost:9000/dist/jbrowse-plugin-apollo.umd.development.js',
}
const other: PluginDefinition = {
  name: 'Other',
  url: 'http://localhost:9000/dist/other.umd.js',
}

beforeEach(() => {
  forgetTrustedPlugins()
})

test('nothing remembered by default', () => {
  expect(arePluginsRemembered([apollo])).toBe(false)
})

test('empty list is trivially remembered', () => {
  expect(arePluginsRemembered([])).toBe(true)
})

test('remembers an approved plugin across reads', () => {
  rememberPlugins([apollo])
  expect(arePluginsRemembered([apollo])).toBe(true)
})

test('all listed plugins must be remembered', () => {
  rememberPlugins([apollo])
  expect(arePluginsRemembered([apollo, other])).toBe(false)
  rememberPlugins([other])
  expect(arePluginsRemembered([apollo, other])).toBe(true)
})

test('forget revokes prior approvals', () => {
  rememberPlugins([apollo])
  forgetTrustedPlugins()
  expect(arePluginsRemembered([apollo])).toBe(false)
})

// Keyed on maybePluginUrl, so a definition naming no loader records nothing.
// Keyed on pluginUrl it recorded the display string 'unknown url', which then
// vouched for every other unloadable definition — a different plugin, arriving
// from a different link — without the user ever having seen it.
test('approving a definition that names no loader trusts nothing', () => {
  const broken = {} as PluginDefinition
  rememberPlugins([broken])
  expect(listTrustedPlugins()).toEqual([])
  expect(arePluginsRemembered([broken])).toBe(false)
  expect(arePluginsRemembered([{} as PluginDefinition])).toBe(false)
})

test('a definition that names no loader is never remembered alongside real ones', () => {
  rememberPlugins([apollo])
  expect(arePluginsRemembered([apollo, {} as PluginDefinition])).toBe(false)
})

test('lists what is trusted, sorted, so the revoke UI can show it', () => {
  rememberPlugins([other, apollo])
  expect(listTrustedPlugins()).toEqual([
    'http://localhost:9000/dist/jbrowse-plugin-apollo.umd.development.js',
    'http://localhost:9000/dist/other.umd.js',
  ])
  forgetTrustedPlugins()
  expect(listTrustedPlugins()).toEqual([])
})
