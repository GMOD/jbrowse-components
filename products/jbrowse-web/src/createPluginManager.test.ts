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
