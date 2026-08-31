import LaunchCircularViewF from './index.ts'

import type { CircularViewCommands } from '../CircularView/types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'

interface CapturedAddView {
  type: string
  initialState: CircularViewCommands & { id?: string; height?: number }
}

function setup() {
  const captured: CapturedAddView[] = []
  let handler: ((args: unknown) => unknown) | undefined

  const pluginManager = {
    addToExtensionPoint: (_name: string, fn: (args: unknown) => unknown) => {
      handler = fn
    },
  } as unknown as PluginManager

  const session = {
    addView: (type: string, initialState: CapturedAddView['initialState']) => {
      captured.push({ type, initialState })
      return { id: 'fake' }
    },
  }

  LaunchCircularViewF(pluginManager)
  return { captured, session, run: (args: unknown) => handler!(args) }
}

test('assembly and trackIds reach the view object', () => {
  const { captured, session, run } = setup()
  run({ session, assembly: 'hg38', tracks: ['sv'] })
  expect(captured).toHaveLength(1)
  expect(captured[0]!.type).toBe('CircularView')
  expect(captured[0]!.initialState).toEqual({
    assembly: 'hg38',
    tracks: ['sv'],
  })
})

// the two keys a session spec needs to draw a readable circos of one callset:
// which chromosomes get a slice, and the display config of the chord track
test('displayedRegionNames and per-track display props are forwarded', () => {
  const { captured, session, run } = setup()
  run({
    session,
    assembly: 'hg38',
    displayedRegionNames: ['chr1', 'chr2'],
    tracks: [{ trackId: 'sv', strokeColor: 'red' }],
  })
  expect(captured[0]!.initialState).toEqual({
    assembly: 'hg38',
    displayedRegionNames: ['chr1', 'chr2'],
    tracks: [{ trackId: 'sv', strokeColor: 'red' }],
  })
})

// a plain view prop rides on the same object as the launch keys; the view's own
// preProcessSnapshot is what tells the two apart
test('height rides along beside the launch keys', () => {
  const { captured, session, run } = setup()
  run({ session, assembly: 'hg38', height: 800 })
  expect(captured[0]!.initialState.height).toBe(800)
})

test('a missing assembly throws rather than opening an empty view', () => {
  const { captured, session, run } = setup()
  expect(() => {
    run({ session, tracks: ['sv'] })
  }).toThrow(/No assembly provided/)
  expect(captured).toHaveLength(0)
})
