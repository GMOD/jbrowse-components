import LaunchCircularViewF from './index.ts'

import type { CircularViewInit } from '../CircularView/model.ts'
import type PluginManager from '@jbrowse/core/PluginManager'

interface CapturedLaunchView {
  type: string
  initialState: { id?: string; height?: number; init: CircularViewInit }
}

function setup() {
  const captured: CapturedLaunchView[] = []
  let handler: ((args: unknown) => Promise<unknown>) | undefined

  const pluginManager = {
    addToExtensionPoint: (
      _name: string,
      fn: (args: unknown) => Promise<unknown>,
    ) => {
      handler = fn
    },
  } as unknown as PluginManager

  const session = {
    launchView: (
      type: string,
      initialState: CapturedLaunchView['initialState'],
    ) => {
      captured.push({ type, initialState })
      return { id: 'fake' }
    },
  }

  LaunchCircularViewF(pluginManager)
  return { captured, session, run: (args: unknown) => handler!(args) }
}

test('assembly and trackIds reach the view init', async () => {
  const { captured, session, run } = setup()
  await run({ session, assembly: 'hg38', tracks: ['sv'] })
  expect(captured).toHaveLength(1)
  expect(captured[0]!.type).toBe('CircularView')
  expect(captured[0]!.initialState.init).toEqual({
    assembly: 'hg38',
    displayedRegionNames: undefined,
    tracks: ['sv'],
  })
})

// the two keys a session spec needs to draw a readable circos of one callset:
// which chromosomes get a slice, and the display config of the chord track
test('displayedRegionNames and per-track display props are forwarded', async () => {
  const { captured, session, run } = setup()
  await run({
    session,
    assembly: 'hg38',
    displayedRegionNames: ['chr1', 'chr2'],
    tracks: [{ trackId: 'sv', strokeColor: 'red' }],
  })
  expect(captured[0]!.initialState.init).toEqual({
    assembly: 'hg38',
    displayedRegionNames: ['chr1', 'chr2'],
    tracks: [{ trackId: 'sv', strokeColor: 'red' }],
  })
})

// height is a plain view prop, so it belongs on the view snapshot and not in
// the init blob that afterAttach applies and throws away
test('height lands on the view snapshot, not in init', async () => {
  const { captured, session, run } = setup()
  await run({ session, assembly: 'hg38', height: 800 })
  expect(captured[0]!.initialState.height).toBe(800)
  expect(captured[0]!.initialState.init).not.toHaveProperty('height')
})

test('a missing assembly throws rather than opening an empty view', async () => {
  const { captured, session, run } = setup()
  await expect(run({ session, tracks: ['sv'] })).rejects.toThrow(
    /No assembly provided/,
  )
  expect(captured).toHaveLength(0)
})
