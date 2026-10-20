import {
  arePluginsRemembered,
  configNeedsNoPrompt,
  forgetTrustedPlugins,
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

test('a relative plugin is remembered for the config it resolved against only', () => {
  const at = (baseUri: string): PluginDefinition => ({
    name: 'Rel',
    umdLoc: { uri: 'plugin.js', baseUri },
  })
  rememberPlugins([at('https://lab-a.org/config.json')])
  expect(arePluginsRemembered([at('https://lab-a.org/other.json')])).toBe(true)
  expect(arePluginsRemembered([at('https://evil.org/config.json')])).toBe(false)
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
  expect(arePluginsRemembered([broken])).toBe(false)
  expect(arePluginsRemembered([{} as PluginDefinition])).toBe(false)
})

test('a definition that names no loader is never remembered alongside real ones', () => {
  rememberPlugins([apollo])
  expect(arePluginsRemembered([apollo, {} as PluginDefinition])).toBe(false)
})

test('a dev build reads a config from another loopback port without a prompt', () => {
  const app = new URL('http://localhost:3000/')
  expect(
    configNeedsNoPrompt(new URL('http://localhost:9000/c.json'), app),
  ).toBe(true)
  expect(
    configNeedsNoPrompt(new URL('http://127.0.0.1:9000/c.json'), app),
  ).toBe(true)
})

test('a config from elsewhere still prompts, on a dev build or a deployed one', () => {
  expect(
    configNeedsNoPrompt(
      new URL('https://example.org/c.json'),
      new URL('http://localhost:3000/'),
    ),
  ).toBe(false)
  expect(
    configNeedsNoPrompt(
      new URL('http://localhost:9000/c.json'),
      new URL('https://jbrowse.org/code/jb2/main/'),
    ),
  ).toBe(false)
})
