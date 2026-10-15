import { createPluginManager } from './createPluginManager.ts'

import type { SessionSource } from './types.ts'

jest.mock('./makeWorkerInstance', () => () => {})

async function sessionNameFor(
  sessionSource: SessionSource,
  sessionName?: string,
) {
  const pluginManager = await createPluginManager(
    {
      configSnapshot: {
        configuration: {
          rpc: { defaultDriver: 'MainThreadRpcDriver' },
          disableAnalytics: true,
        },
      },
      sessionSource,
      sessionName,
      initialTimestamp: 0,
    },
    () => {},
  )
  return pluginManager.rootModel!.session!.name
}

// `?extendSession=true&sessionTracks=[…]` opened the configured default
// session with the tracks dropped and no diagnostic
test('a default session gets the link’s sessionTracks', async () => {
  const pluginManager = await createPluginManager(
    {
      configSnapshot: {
        configuration: {
          rpc: { defaultDriver: 'MainThreadRpcDriver' },
          disableAnalytics: true,
        },
        defaultSession: { name: 'Curated' },
      },
      sessionSource: { type: 'default' },
      defaultSessionTracks: [
        {
          trackId: 'url_track',
          type: 'FeatureTrack',
          name: 'URL track',
          assemblyNames: ['volvox'],
          adapter: { type: 'FromConfigAdapter', features: [] },
        },
      ],
      initialTimestamp: 0,
    },
    () => {},
  )
  const session = pluginManager.rootModel!.session as unknown as {
    sessionTracks: { trackId: string }[]
  }
  expect(session.sessionTracks.map(t => t.trackId)).toEqual(['url_track'])
})

describe('a spec session', () => {
  const spec = { sessionName: 'From the spec', views: [] }

  test('keeps its own sessionName when the URL names none', async () => {
    expect(await sessionNameFor({ type: 'spec', spec })).toBe('From the spec')
  })

  test('takes &sessionName= over its own', async () => {
    expect(await sessionNameFor({ type: 'spec', spec }, 'From the URL')).toBe(
      'From the URL',
    )
  })
})
