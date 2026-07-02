import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { getAboutDialogConfig, readConfSlot, removeAttr } from './util.ts'

import type { AbstractSessionModel } from '@jbrowse/core/util'

// real PluginManager provides the jexl instance used by callback config slots
const corePluginManager = new PluginManager([]).createPluggableElements()
corePluginManager.configure()

const FormatAbout = ConfigurationSchema('FormatAbout', {
  config: { type: 'frozen', defaultValue: {}, contextVariable: ['config'] },
  hideUris: { type: 'boolean', defaultValue: false },
})

const TrackConf = ConfigurationSchema(
  'TestTrack',
  {
    name: { type: 'string', defaultValue: '' },
    formatAbout: FormatAbout,
  },
  { explicitIdentifier: 'trackId' },
)

const SessionModel = types.model('Session', {
  configuration: ConfigurationSchema('Root', { formatAbout: FormatAbout }),
})

// extension point passthrough so getAboutDialogConfig returns its input
const passthroughPluginManager = {
  evaluateExtensionPoint: (_name: string, arg: unknown) => arg,
} as unknown as PluginManager

function makeSession(formatAboutConfig: Record<string, unknown> = {}) {
  return SessionModel.create(
    { configuration: { formatAbout: { config: formatAboutConfig } } },
    { pluginManager: corePluginManager },
  ) as unknown as AbstractSessionModel
}

describe('removeAttr', () => {
  it('deletes the attribute at every nesting level', () => {
    const obj = {
      a: 1,
      baseUri: 'top',
      b: { baseUri: 'nested', c: 2, d: { baseUri: 'deep', e: 3 } },
    }
    expect(removeAttr(obj, 'baseUri')).toEqual({
      a: 1,
      b: { c: 2, d: { e: 3 } },
    })
  })

  it('leaves null values intact', () => {
    expect(removeAttr({ a: null, baseUri: 'x' }, 'baseUri')).toEqual({
      a: null,
    })
  })
})

describe('readConfSlot', () => {
  it('walks a path on a plain object', () => {
    expect(readConfSlot({ foo: { bar: 5 } }, ['foo', 'bar'])).toBe(5)
  })

  it('evaluates a jexl string on a plain object', () => {
    expect(readConfSlot({ foo: 'jexl:1+2' }, 'foo')).toBe(3)
  })

  it('passes context args to a jexl string on a plain object', () => {
    expect(
      readConfSlot({ foo: 'jexl:config.name' }, 'foo', {
        config: { name: 'hello' },
      }),
    ).toBe('hello')
  })

  it('returns an empty jexl body literally instead of throwing', () => {
    expect(readConfSlot({ foo: 'jexl:' }, 'foo')).toBe('jexl:')
  })

  it('reads a slot from a state tree node', () => {
    const config = TrackConf.create(
      { trackId: 't1', name: 'Track 1' },
      { pluginManager: corePluginManager },
    )
    expect(readConfSlot(config, 'name')).toBe('Track 1')
  })

  it('passes context args to a callback slot on a state tree node', () => {
    const config = TrackConf.create(
      {
        trackId: 't1',
        name: 'Track 1',
        formatAbout: { config: "jexl:{'Computed': config.name}" },
      },
      { pluginManager: corePluginManager },
    )
    expect(
      readConfSlot(config, ['formatAbout', 'config'], {
        config: { name: 'Track 1' },
      }),
    ).toEqual({ Computed: 'Track 1' })
  })
})

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
