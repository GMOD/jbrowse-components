import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import { getEnv } from '@jbrowse/mobx-state-tree'
import { WIDTH_FADE_FLOOR } from '@jbrowse/synteny-core'
import { createTestSession } from '@jbrowse/web/testUtils'
import { reaction, when } from 'mobx'

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

test('a circle of one genome, hand-authored, paints by chromosome', async () => {
  const session = createTestSession() as any
  const { pluginManager } = getEnv(session)
  await pluginManager.getViewType('CircularView').loadStateModel()
  const circle = session.addView('CircularView', {}) as CircularViewModel
  expect(circle.colorField).toBe('query')
})

// a capture waits on the chord canvas having painted, which a circle with no
// chord display never does
test('a circle with no chord display has finished its chord canvas', async () => {
  const session = createTestSession() as any
  const { pluginManager } = getEnv(session)
  await pluginManager.getViewType('CircularView').loadStateModel()
  const bare = session.addView('CircularView', {}) as CircularViewModel
  expect(bare.chordPass.painted).toBe(true)
  const { circle } = await launch({})
  expect(circle.chordPass.painted).toBe(false)
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

// The chords and the key read one declared ramp: identity 0.5 sits on the
// pinned bottom, so it takes the range's first colour, and the key's bar
// starts there.
test('a declared ramp reaches the chords and the key', async () => {
  const { circle, display } = await launch({
    color: {
      field: 'identity',
      domainMin: 0.5,
      range: ['#ff0000', '#0000ff'],
    },
  })
  expect(display.ribbonLanes.color[0]! & 0xffffff).toBe(
    cssColorToABGR('#ff0000') & 0xffffff,
  )
  const bar = circle.legendSpec.sections
    .flatMap(s => s.items)
    .find(item => item.gradient)
  expect(bar?.gradient).toMatchObject({ minLabel: '50%', maxLabel: '100%' })
}, 40000)

// A twist on the circle is against arcs whose direction nothing draws, so the
// colour is the only strand cue.
test('strand keys its two colours', async () => {
  const { circle } = await launch({ color: { field: 'strand' } })
  expect(
    circle.legendSpec.sections.flatMap(s => s.items.map(item => item.label)),
  ).toEqual(['forward', 'reverse'])
}, 40000)

test('the identity fade reaches the ribbon’s alpha', async () => {
  const { circle, display } = await launch({})
  expect(display.ribbonLanes.color[0]! >>> 24).toBe(255)
  circle.setOpacityByIdentity(true)
  expect(display.ribbonLanes.color[0]! >>> 24).toBe(Math.round(0.5 * 255))
}, 40000)

describe('a hovered band', () => {
  const keyOf = (circle: CircularViewModel, assemblyName: string) =>
    circle.staticSlices.find(
      ({ region }) =>
        !region.elided &&
        region.assemblyName === assemblyName &&
        region.refName === 'ctgB',
    )!.key

  test('is found under the pointer, off it the chords are', async () => {
    const { circle } = await launch({})
    circle.rotate(1)
    for (const { key, region } of circle.staticSlices) {
      if (!region.elided) {
        expect(circle.bandAt(...circle.bandCenter(key)!)).toBe(key)
      }
    }
    expect(circle.bandAt(0, 0)).toBeUndefined()
  }, 40000)

  test('focuses the chord stage on its slice', async () => {
    const { circle } = await launch({})
    expect(circle.chordPass.frame.focusGaps).toBe(-1)
    circle.setHover({ kind: 'band', key: keyOf(circle, 'B') })
    expect(circle.chordPass.frame.focusGaps).toBe(
      circle.chordAxis.byKey.get('B\u0000ctgB')!.gaps,
    )
    circle.setHover(undefined)
    expect(circle.chordPass.frame.focusGaps).toBe(-1)
  }, 40000)

  test('a move within it moves only the tooltip', async () => {
    const { circle } = await launch({})
    circle.setHover({ kind: 'band', key: keyOf(circle, 'B') }, 10, 10)
    const hover = circle.hover
    let recomputed = 0
    const stop = reaction(
      () => circle.bandComposition,
      () => {
        recomputed++
      },
    )
    circle.setHover({ kind: 'band', key: keyOf(circle, 'B') }, 12, 11)
    stop()
    expect(circle.hover).toBe(hover)
    expect(circle.hoverClientXY).toEqual([12, 11])
    expect(recomputed).toBe(0)
  }, 40000)

  test('names the same chromosome after a reorder', async () => {
    const { circle } = await launch({ autoDiagonalize: false })
    circle.setHover({ kind: 'band', key: keyOf(circle, 'B') })
    circle.setDisplayedRegions([...circle.displayedRegions].reverse())
    expect(circle.bandComposition?.name).toBe('B ctgB')
  }, 40000)

  // three 5 kb alignments a kb apart cover 7 kb of the 16 kb contig
  test('names the share of it each partner covers', async () => {
    const { circle } = await launch({})
    circle.setHover({ kind: 'band', key: keyOf(circle, 'B') })
    expect(circle.bandComposition).toEqual({
      name: 'B ctgB',
      shares: [{ partner: 'A ctgA', fraction: 7000 / 16000 }],
    })
  }, 40000)

  test('counts only the bases on the region the circle draws', async () => {
    const { circle } = await launch({})
    circle.setDisplayedRegions(
      circle.displayedRegions.map(r =>
        r.assemblyName === 'B' && r.refName === 'ctgB'
          ? { ...r, start: 0, end: 1000 }
          : r,
      ),
    )
    circle.setHover({ kind: 'band', key: keyOf(circle, 'B') })
    expect(circle.bandComposition?.shares).toEqual([
      { partner: 'A ctgA', fraction: 0.5 },
    ])
  }, 40000)
})
