import {
  arePluginsRemembered,
  forgetTrustedPlugins,
  rememberPlugins,
} from './trustedPlugins.ts'

import type { PluginDefinition } from '@jbrowse/core/PluginLoader'

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
