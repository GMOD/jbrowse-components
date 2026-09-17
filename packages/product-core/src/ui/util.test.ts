import {
  ConfigurationSchema,
  FormatAboutConfigSchemaFactory,
} from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { aboutTestPluginManager, makeTrackConf } from './aboutTestUtils.ts'
import { getAboutDialogConfig } from './util.ts'

import type { AbstractSessionModel } from '@jbrowse/core/util'

const SessionModel = types.model('Session', {
  configuration: ConfigurationSchema('Root', {
    formatAbout: FormatAboutConfigSchemaFactory(),
  }),
})

function makeSession(
  formatAboutConfig: Record<string, unknown> = {},
  hideUris = false,
) {
  return SessionModel.create(
    { configuration: { formatAbout: { config: formatAboutConfig, hideUris } } },
    { pluginManager: aboutTestPluginManager },
  ) as unknown as AbstractSessionModel
}

describe('getAboutDialogConfig', () => {
  it('shows the config as written', () => {
    const out = getAboutDialogConfig({
      config: makeTrackConf({ trackId: 't1', name: 'Track 1' }),
      session: makeSession(),
    })
    expect(out.config.name).toBe('Track 1')
  })

  it('applies a track-level formatAbout.config jexl with config context', () => {
    // regression: the track formatAbout.config callback must receive the
    // resolved config as context, matching the session-level behavior
    const config = makeTrackConf({
      trackId: 't1',
      name: 'Track 1',
      formatAbout: { config: "jexl:{'Computed': config.name}" },
    })
    const out = getAboutDialogConfig({ config, session: makeSession() })
    expect(out.config.Computed).toBe('Track 1')
  })

  it('lets session formatAbout.config override and track override that', () => {
    const config = makeTrackConf({
      trackId: 't1',
      name: 'Track 1',
      formatAbout: { config: { source: 'track' } },
    })
    const out = getAboutDialogConfig({
      config,
      session: makeSession({ source: 'session', sessionOnly: true }),
    })
    // track formatAbout wins over session formatAbout
    expect(out.config.source).toBe('track')
    expect(out.config.sessionOnly).toBe(true)
  })

  // `jexl:config.name` where `jexl:{Name:config.name}` was meant. Spread, the
  // string became dialog rows keyed 0, 1, 2; dropped, it did nothing
  it('refuses a callback that returns something other than an object', () => {
    const config = makeTrackConf({
      trackId: 't1',
      name: 'Track 1',
      formatAbout: { config: 'jexl:config.name' },
    })
    expect(() =>
      getAboutDialogConfig({ config, session: makeSession() }),
    ).toThrow('returned a string')
  })

  // the two formatAbout slots fold differently: `config` is a merge a track can
  // win key-by-key, `hideUris` is an OR a track cannot turn back off
  it.each([
    [false, false, false],
    [false, true, true],
    [true, false, true],
    [true, true, true],
  ])('ORs hideUris (session %p, track %p)', (session, track, expected) => {
    const config = makeTrackConf({
      trackId: 't1',
      formatAbout: { hideUris: track },
    })
    expect(
      getAboutDialogConfig({ config, session: makeSession({}, session) })
        .hideUris,
    ).toBe(expected)
  })
})
