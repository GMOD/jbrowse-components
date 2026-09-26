import { WIDTH_FADE_FLOOR } from '@jbrowse/synteny-core'
import { createTestSession } from '@jbrowse/web/testUtils'
import { when } from 'mobx'

import type { CircularViewModel } from './model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

function assemblyConf(name: string) {
  return {
    name,
    sequence: {
      trackId: `${name}_refseq`,
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: ['ctgA', 'ctgB'].map(refName => ({
          refName,
          uniqueId: `${name}-${refName}`,
          start: 0,
          end: 16000,
          seq: 'a'.repeat(16000),
        })),
      },
    },
  }
}

// `count` alignments of `lengthBp` each from A's ctgA to B's ctgB. On an 800 px
// circle of 64 kb a base is about a thirtieth of a pixel.
function alignments(count: number, lengthBp: number) {
  return Array.from({ length: count }, (_, i) => ({
    uniqueId: `aln${i}`,
    assemblyName: 'A',
    refName: 'ctgA',
    start: 500 + i * 1000,
    end: 500 + i * 1000 + lengthBp,
    strand: 1,
    identity: 0.5,
    mate: {
      assemblyName: 'B',
      refName: 'ctgB',
      start: 500 + i * 1000,
      end: 500 + i * 1000 + lengthBp,
    },
  }))
}

async function launch(
  view: Record<string, unknown>,
  features = alignments(3, 5000),
) {
  const session = createTestSession() as any
  session.addAssemblyConf(assemblyConf('A'))
  session.addAssemblyConf(assemblyConf('B'))
  session.addSessionTrackConf({
    trackId: 'aln',
    name: 'A vs B',
    type: 'SyntenyTrack',
    assemblyNames: ['B', 'A'],
    adapter: { type: 'FromConfigAdapter', features },
  })
  const circle = (await session.launchView('CircularView', {
    assembly: ['A', 'B'],
    tracks: ['aln'],
    ...view,
  })) as CircularViewModel
  circle.setWidth(800)
  await when(() => circle.pendingLaunch === undefined, { timeout: 30000 })
  const display = circle.chordSyntenyDisplays[0] as unknown as {
    ready: boolean
    ribbonLanes: { color: Uint32Array; count: number }
  }
  await when(() => display.ready, { timeout: 30000 })
  return { circle, display }
}

describe('a two-genome circle', () => {
  test('opens coloured by the first genome’s chromosomes', async () => {
    const { circle } = await launch({})
    expect(circle.colorField).toBe('query')
  }, 40000)

  test('keeps a colour its launch chose', async () => {
    const { circle } = await launch({ color: { field: 'strand' } })
    expect(circle.colorField).toBe('strand')
    const constant = await launch({ color: 'grey' })
    expect(constant.circle.colorField).toBe('')
  }, 40000)

  test('reorders its second genome unless the launch says not to', async () => {
    const layout = (circle: CircularViewModel) =>
      circle.displayedRegions.map(
        r => `${r.assemblyName}:${r.refName}:${!!r.reversed}`,
      )
    const unsaid = await launch({})
    const asked = await launch({ autoDiagonalize: true })
    const declined = await launch({ autoDiagonalize: false })
    expect(unsaid.circle.pendingAutoDiagonalize).toBe(false)
    expect(layout(unsaid.circle)).toEqual(layout(asked.circle))
    expect(layout(unsaid.circle)).not.toEqual(layout(declined.circle))
  }, 40000)
})

describe('the thin fade', () => {
  test('engages on a circle of sub-pixel alignments', async () => {
    const { circle } = await launch({}, alignments(12, 10))
    await when(() => circle.fadeThinAlignments, { timeout: 5000 })
    expect(circle.chordThinFadeFloor).toBe(WIDTH_FADE_FLOOR)
  }, 40000)

  test('leaves alignments wider than a pixel at full alpha', async () => {
    const { circle } = await launch({}, alignments(12, 800))
    expect(circle.fadeThinAlignments).toBe(false)
    expect(circle.chordThinFadeFloor).toBe(1)
  }, 40000)

  test('stays off when the session pins it off', async () => {
    const { circle } = await launch(
      { fadeThinAlignmentsMode: 'off' },
      alignments(12, 10),
    )
    expect(circle.chordThinFadeFloor).toBe(1)
  }, 40000)
})

test('the identity fade reaches the ribbon’s alpha', async () => {
  const { circle, display } = await launch({})
  expect(display.ribbonLanes.color[0]! >>> 24).toBe(255)
  circle.setOpacityByIdentity(true)
  expect(display.ribbonLanes.color[0]! >>> 24).toBe(Math.round(0.5 * 255))
}, 40000)
