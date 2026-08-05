import Plugin from '@jbrowse/core/Plugin'

import createViewState from './createViewState.ts'

import type { PluginDefinition } from '@jbrowse/core/pluginDefinitions'

jest.mock('./makeWorkerInstance', () => () => {})

class TestPlugin extends Plugin {
  name = 'TestPlugin'
}

const definition: PluginDefinition = {
  name: 'TestPlugin',
  umdUrl: 'https://example.com/test-plugin.umd.js',
}

const assemblies = [
  {
    name: 'volvox',
    sequence: {
      type: 'ReferenceSequenceTrack',
      trackId: 'volvox_refseq',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          {
            refName: 'ctgA',
            uniqueId: 'firstId',
            start: 0,
            end: 10,
            seq: 'cattgttgcg',
          },
        ],
      },
    },
  },
]

// The host loads plugins and hands them in as `plugins`; the props-driven
// entry points (<JBrowse>, createApp) have no way to name them in the config at
// all. If they aren't recorded as the app's plugin set, onPluginsUpdated — whose
// whole job is to say what a rebuild has to load — answers with a set missing
// them, and the host remounts without the plugins it launched with.
test('the plugins the host loaded become the app plugin set', () => {
  const state = createViewState({
    config: { assemblies },
    plugins: [{ plugin: TestPlugin, definition }],
  })

  expect([...state.jbrowse.plugins]).toEqual([definition])
})

test('onPluginsUpdated hands back the launch plugins, not just the session ones', () => {
  const onPluginsUpdated = jest.fn()
  const state = createViewState({
    config: { assemblies },
    plugins: [{ plugin: TestPlugin, definition }],
    onPluginsUpdated,
  })

  state.setPluginsUpdated()

  expect(onPluginsUpdated).toHaveBeenCalledTimes(1)
  expect(onPluginsUpdated.mock.calls[0]![0].plugins).toEqual([definition])
})

// a definition the config names but the host never loaded is the failure the
// warning exists for: every track needing it fails on its own, far from here
test('warns about a named plugin that was not loaded, naming it', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})

  createViewState({
    config: {
      assemblies,
      plugins: [definition, { name: 'Other', umdUrl: 'https://e.com/o.js' }],
    },
    plugins: [{ plugin: TestPlugin, definition }],
  })

  expect(warn).toHaveBeenCalledTimes(1)
  const [message] = warn.mock.calls[0]!
  expect(message).toContain('Other')
  expect(message).not.toContain('TestPlugin')

  warn.mockRestore()
})

// the File menu can open a connection interactively, so a config that ships one
// should be able to say so — `connections` was missing from the Config type
test('a config can declare connections', () => {
  const state = createViewState({
    config: {
      assemblies,
      connections: [
        {
          type: 'JBrowse1Connection',
          connectionId: 'jb1',
          dataDirLocation: { uri: 'https://example.com/data' },
        },
      ],
    },
  })

  expect(state.jbrowse.connections).toHaveLength(1)
  expect(state.jbrowse.connections[0]!.connectionId).toBe('jb1')
})

test('says nothing when every named plugin was loaded', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})

  createViewState({
    config: { assemblies, plugins: [definition] },
    plugins: [{ plugin: TestPlugin, definition }],
  })

  expect(warn).not.toHaveBeenCalled()

  warn.mockRestore()
})
