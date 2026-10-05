/**
 * @jest-environment jsdom
 */
import { getEnv } from '@jbrowse/core/util'
import { createViewStateAsync } from '@jbrowse/react-app2'

import {
  buildDisplaySnapshot,
  categorizedTrackTypes,
} from './applyTrackOpts.ts'

test('every registered track type has a category', async () => {
  const model = await createViewStateAsync({
    config: {
      assemblies: [],
      tracks: [],
      configuration: { rpc: { defaultDriver: 'MainThreadRpcDriver' } },
    },
  })
  const { pluginManager } = getEnv(model)
  const registered = [...pluginManager.getElementTypesInGroup('track')].map(
    (t: { name: string }) => t.name,
  )
  expect(registered.length).toBeGreaterThan(8)
  expect(
    registered.filter(type => !categorizedTrackTypes.includes(type)),
  ).toEqual([])
}, 60000)

describe('a track whose display no translating modifier targets', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
  afterEach(() => {
    warn.mockClear()
  })

  test.each(['heightMode:fit', 'featureHeight:compact', 'sashimi:up'])(
    '%s warns and writes nothing',
    opt => {
      expect(buildDisplaySnapshot('other', [opt]).snap).toEqual({})
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('has no effect on this track type'),
      )
    },
  )

  test('height, force and a constant color still apply', () => {
    expect(
      buildDisplaySnapshot('other', ['height:200', 'force', 'color:strand'])
        .snap,
    ).toEqual({ height: 200, forceLoad: true, color: 'strand' })
  })
})
