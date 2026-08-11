import PluginManager from '@jbrowse/core/PluginManager'
import {
  ConfigurationSchema,
  FormatAboutConfigSchemaFactory,
} from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { getAboutDialogConfig } from './util.ts'

import type { AbstractSessionModel } from '@jbrowse/core/util'

// real PluginManager provides the jexl instance used by callback config slots
const corePluginManager = new PluginManager([]).createPluggableElements()
corePluginManager.configure()

// the shipped schema, the same one a track and the root config both carry
const TrackConf = ConfigurationSchema(
  'TestTrack',
  {
    name: { type: 'string', defaultValue: '' },
    formatAbout: FormatAboutConfigSchemaFactory(),
  },
  { explicitIdentifier: 'trackId' },
)

const SessionModel = types.model('Session', {
  configuration: ConfigurationSchema('Root', {
    formatAbout: FormatAboutConfigSchemaFactory(),
  }),
})

// extension point passthrough so getAboutDialogConfig returns its input
const passthroughPluginManager = {
  evaluateExtensionPoint: (_name: string, arg: unknown) => arg,
} as unknown as PluginManager

function makeSession(
  formatAboutConfig: Record<string, unknown> = {},
  hideUris = false,
) {
  return SessionModel.create(
    { configuration: { formatAbout: { config: formatAboutConfig, hideUris } } },
    { pluginManager: corePluginManager },
  ) as unknown as AbstractSessionModel
}

// readConfSlot itself is covered in
// packages/core/src/configuration/readConfSlot.test.ts
describe('getAboutDialogConfig', () => {
  it('merges the base config for a plain object', () => {
    const config = { trackId: 't1', name: 'Track 1' }
    const out = getAboutDialogConfig({
      config,
      session: makeSession(),
      pluginManager: passthroughPluginManager,
    })
    expect(out.config.name).toBe('Track 1')
  })

  it('applies a track-level formatAbout.config jexl with config context', () => {
    // regression: the track formatAbout.config callback must receive the
    // resolved config as context, matching the session-level behavior
    const config = TrackConf.create(
      {
        trackId: 't1',
        name: 'Track 1',
        formatAbout: { config: "jexl:{'Computed': config.name}" },
      },
      { pluginManager: corePluginManager },
    )
    const out = getAboutDialogConfig({
      config,
      session: makeSession(),
      pluginManager: passthroughPluginManager,
    })
    expect(out.config.Computed).toBe('Track 1')
  })

  it('lets session formatAbout.config override and track override that', () => {
    const config = TrackConf.create(
      {
        trackId: 't1',
        name: 'Track 1',
        formatAbout: { config: { source: 'track' } },
      },
      { pluginManager: corePluginManager },
    )
    const out = getAboutDialogConfig({
      config,
      session: makeSession({ source: 'session', sessionOnly: true }),
      pluginManager: passthroughPluginManager,
    })
    // track formatAbout wins over session formatAbout
    expect(out.config.source).toBe('track')
    expect(out.config.sessionOnly).toBe(true)
  })

  // `jexl:config.name` where `jexl:{Name:config.name}` was meant. Spread, the
  // string became dialog rows keyed 0, 1, 2
  it('drops a callback that returns something other than an object', () => {
    const config = TrackConf.create(
      {
        trackId: 't1',
        name: 'Track 1',
        formatAbout: { config: 'jexl:config.name' },
      },
      { pluginManager: corePluginManager },
    )
    const out = getAboutDialogConfig({
      config,
      session: makeSession(),
      pluginManager: passthroughPluginManager,
    })
    expect(out.config).not.toHaveProperty('0')
    expect(out.config.name).toBe('Track 1')
  })

  // the two formatAbout slots fold differently: `config` is a merge a track can
  // win key-by-key, `hideUris` is an OR a track cannot turn back off
  it.each([
    [false, false, false],
    [false, true, true],
    [true, false, true],
    [true, true, true],
  ])('ORs hideUris (session %p, track %p)', (session, track, expected) => {
    const config = TrackConf.create(
      { trackId: 't1', formatAbout: { hideUris: track } },
      { pluginManager: corePluginManager },
    )
    expect(
      getAboutDialogConfig({
        config,
        session: makeSession({}, session),
        pluginManager: passthroughPluginManager,
      }).hideUris,
    ).toBe(expected)
  })

  it('routes the merged config through Core-customizeAbout', () => {
    const calls: { name: string; arg: unknown }[] = []
    const pluginManager = {
      evaluateExtensionPoint: (name: string, arg: unknown) => {
        calls.push({ name, arg })
        return arg
      },
    } as unknown as PluginManager
    getAboutDialogConfig({
      config: { trackId: 't1', name: 'Track 1' },
      session: makeSession(),
      pluginManager,
    })
    expect(calls.map(c => c.name)).toContain('Core-customizeAbout')
  })
})
