import fs from 'node:fs'
import path from 'node:path'

import { SimpleFeature } from '@jbrowse/core/util'
import { testAssembly } from '@jbrowse/display-test-utils'
import { autorun, observable, runInAction, when } from 'mobx'

import {
  MIN_LANE_PITCH,
  buildLanes,
  laneContentHeight,
  laneGeometry,
} from './laneStack.ts'
import { groupFeatures, rowFrameX } from './layoutMultiWay.ts'
import { createDisplay, createDisplayWithSession } from './testEnv.ts'

import type { BuildLanesOpts } from './laneStack.ts'
import type { RowFrame, Span } from './layoutMultiWay.ts'
import type { TestAssembly } from '@jbrowse/display-test-utils'

const WIDTH = 800
const HEIGHT = 240

function pairFeature(name: string, start: number, end: number) {
  return new SimpleFeature({
    uniqueId: `${name}-peach`,
    refName: 'chr1',
    start,
    end,
    strand: 1,
    name,
    assemblyName: 'grape',
    mate: {
      assemblyName: 'peach',
      refName: 'Pp1',
      start: start + 1000,
      end: end + 1000,
      name: `p-${name}`,
    },
  })
}

const groups = groupFeatures([
  pairFeature('g1', 100, 200),
  pairFeature('g2', 300, 400),
])

const peachFrame: RowFrame = {
  refName: 'Pp1',
  min: 1000,
  max: 2000,
  flipped: false,
  alsoOn: [],
  alsoOnMore: 0,
  fitMin: 1100,
  fitMax: 1400,
}

// the anchor lane's axis, standing in for the view's piecewise `bpToPx`: a
// linear map over chr1:0-1000 that CLIPS, the way `axisSpan` does
const axisSpanOf = (refName: string, start: number, end: number) =>
  refName === 'chr1'
    ? ([
        (Math.min(Math.max(start, 0), 1000) / 1000) * WIDTH,
        (Math.min(Math.max(end, 0), 1000) / 1000) * WIDTH,
      ] as Span)
    : undefined

function stack(overrides: Partial<BuildLanesOpts> = {}) {
  return buildLanes({
    assemblyNames: ['grape', 'peach'],
    groups,
    anchorSpans: new Map(
      groups.map(g => [
        g.key,
        axisSpanOf('chr1', g.anchor.start, g.anchor.end)!,
      ]),
    ),
    rowFrames: new Map([['peach', peachFrame]]),
    laneGeneAdapters: new Map([['grape', {}]]),
    axisSpanOf,
    anchorRegionSpans: [axisSpanOf('chr1', 0, 1000)!],
    contigOf: () => undefined,
    refNameAliasOf: () => undefined,
    width: WIDTH,
    height: HEIGHT,
    ...overrides,
  })
}

test('the anchor lane is the top one, on the view axis rather than a frame', () => {
  const { lanes } = stack()
  expect(lanes.map(l => l.assemblyName)).toEqual(['grape', 'peach'])
  expect(lanes.map(l => l.isAnchor)).toEqual([true, false])
  expect(lanes[0]!.frame).toBeUndefined()
  expect(lanes[1]!.frame).toBe(peachFrame)
  expect(lanes[0]!.glyphTop).toBeLessThan(lanes[1]!.glyphTop)
})

test('each lane places the groups in its own coordinates', () => {
  const [anchor, peach] = stack().lanes
  // the anchor lane draws where the view draws: 100-200bp of chr1:0-1000 in 800px
  expect(anchor!.placements.get('g1')?.spans).toEqual([[80, 160]])
  // the mate lane draws through its frame: Pp1:1100-1200 of a 1000bp frame
  expect(peach!.placements.get('g1')?.spans).toEqual([[80, 160]])
  expect([...peach!.placements.keys()]).toEqual(['g1', 'g2'])
})

// A lane the visible groups place nothing on does not break the stack — the
// header, the band and the ticks still draw, and the next lane down still lines
// up against the last lane that had a frame.
test('a mate lane with no frame gets a lane and no spans', () => {
  const { lanes } = stack({ rowFrames: new Map() })
  expect(lanes).toHaveLength(2)
  expect(lanes[1]!.frame).toBeUndefined()
  expect(lanes[1]!.placements.size).toBe(0)
  expect(lanes[1]!.spanOf('Pp1', 1100, 1200)).toBeUndefined()
})

describe('the map a lane answers intervals with', () => {
  test('clips on the anchor lane rather than dropping a straddler', () => {
    const [anchor] = stack().lanes
    expect(anchor!.spanOf('chr1', 900, 1500)).toEqual([720, WIDTH])
    expect(anchor!.spanOf('Pp1', 100, 200)).toBeUndefined()
  })

  test('clips a mate lane half a screen past its frame, and answers nothing off its contig', () => {
    const [, peach] = stack().lanes
    expect(peach!.spanOf('Pp1', 1900, 3000)).toEqual([720, 1.5 * WIDTH])
    expect(peach!.spanOf('Pp1', 2250, 2500)).toEqual([1000, 1.5 * WIDTH])
    expect(peach!.spanOf('Pp1', 2600, 4000)).toBeUndefined()
    expect(peach!.spanOf('Pp2', 1100, 1200)).toBeUndefined()
  })

  // A placement carries whatever refName the table's BED used and a gene
  // whatever that assembly's GFF3 used; for a genome whose annotation names
  // sequences by INSDC accession those are `CM028642.2` and `3L`.
  test('goes through the lane assembly own alias table', () => {
    const [, peach] = stack({
      refNameAliasOf: name =>
        name === 'peach'
          ? refName => (refName === 'CM1.2' ? 'Pp1' : refName)
          : undefined,
    }).lanes
    expect(peach!.spanOf('CM1.2', 1100, 1200)).toEqual([80, 160])
    expect(peach!.canon('CM1.2')).toBe('Pp1')
  })

  // The common case for a mate lane: the ortholog table names a genome the
  // session never loaded, so there is no alias table and the file's own
  // spelling has to pass through rather than resolving to nothing.
  test('passes a refName through for an assembly the session does not hold', () => {
    const [, peach] = stack().lanes
    expect(peach!.canon('Pp1')).toBe('Pp1')
    expect(peach!.spanOf('Pp1', 1100, 1200)).toEqual([80, 160])
  })
})

describe('the baseline', () => {
  const DIVIDER = [[-WIDTH, 2 * WIDTH]]
  const pp1 = (_assemblyName: string, refName: string) =>
    refName === 'Pp1' ? { start: 0, end: 1750 } : undefined

  test('a mate lane draws its line only to its contig end', () => {
    expect(stack({ contigOf: pp1 }).lanes[1]!.baseline).toEqual([[-WIDTH, 600]])
    const flipped = stack({
      contigOf: pp1,
      rowFrames: new Map([['peach', { ...peachFrame, flipped: true }]]),
    })
    expect(flipped.lanes[1]!.baseline).toEqual([[200, 2 * WIDTH]])
  })

  test('a frame reaching below 0 starts the line at 0', () => {
    const { lanes } = stack({
      contigOf: () => ({ start: 0, end: 5000 }),
      rowFrames: new Map([['peach', { ...peachFrame, min: -200, max: 800 }]]),
    })
    expect(lanes[1]!.baseline).toEqual([[160, 2 * WIDTH]])
  })

  test('the contig is looked up by its canonical name', () => {
    const asked: string[] = []
    const { lanes } = stack({
      refNameAliasOf: name =>
        name === 'peach'
          ? refName => (refName === 'Pp1' ? 'peach_chr1' : refName)
          : undefined,
      contigOf: (assemblyName, refName) => {
        asked.push(`${assemblyName}:${refName}`)
        return refName === 'peach_chr1' ? { start: 0, end: 1750 } : undefined
      },
    })
    expect(asked).toEqual(['peach:peach_chr1'])
    expect(lanes[1]!.baseline).toEqual([[-WIDTH, 600]])
  })

  test('a lane with no contig to measure keeps the divider', () => {
    expect(stack().lanes[1]!.baseline).toEqual(DIVIDER)
    expect(
      stack({ contigOf: pp1, rowFrames: new Map() }).lanes[1]!.baseline,
    ).toEqual(DIVIDER)
  })

  test('the anchor lane draws its displayed regions, clipped', () => {
    const { lanes } = stack({
      anchorRegionSpans: [
        [-3000, -900],
        [300, -100],
        [300, 5000],
      ],
      contigOf: pp1,
    })
    expect(lanes[0]!.baseline).toEqual([
      [-100, 300],
      [300, 2 * WIDTH],
    ])
  })

  describe('through the display', () => {
    const CONTIG_END = 50_000

    async function framedDisplay(
      mate: string,
      opts: Parameters<typeof createDisplayWithSession>[0] = {},
    ) {
      const { display } = createDisplayWithSession({
        trackAssemblyNames: ['volvox', mate],
        ...opts,
      })
      await when(() => display.features !== undefined, { timeout: 5000 })
      display.setFeatures(
        [0, 1, 2, 3].map(
          i =>
            new SimpleFeature({
              uniqueId: `g${i}`,
              name: `g${i}`,
              refName: 'ctgA',
              start: 50 + 100 * i,
              end: 110 + 100 * i,
              strand: 1,
              mate: {
                assemblyName: mate,
                refName: 'ctgA',
                start: 49_600 + 100 * i,
                end: 49_660 + 100 * i,
              },
            }),
        ),
      )
      await when(() => display.rowFrames.get(mate) !== undefined, {
        timeout: 5000,
      })
      const frame = display.rowFrames.get(mate)!
      expect(frame.max).toBeGreaterThan(CONTIG_END)
      return {
        display,
        contigLine: [[-WIDTH, rowFrameX(frame, CONTIG_END, WIDTH)]],
      }
    }

    test('a held genome’s lane is named the way the session names it', async () => {
      const { display } = await framedDisplay('volvox_random', {
        assemblyOf: name =>
          testAssembly(
            name === 'volvox_random' ? { displayName: 'Volvox (random)' } : {},
          ),
      })
      expect(display.laneStack.lanes.map(lane => lane.label)).toEqual([
        'volvox',
        'Volvox (random)',
      ])
      expect(display.laneHeaderRows[1]!.label).toMatch(/^Volvox \(random\) {2}/)
      expect(
        display.laneUniverse.find(lane => lane.name === 'volvox_random')?.label,
      ).toBe('Volvox (random)')
    })

    test('a genome the session does not hold takes the label its source declares', async () => {
      const { display } = await framedDisplay('hg002', {
        assemblyOf: () => testAssembly({ displayName: 'someone else' }),
      })
      expect(display.laneStack.lanes[1]!.label).toBe('hg002')
      display.setAdapterHeader({
        adapterConfig: display.adapterConfig,
        value: { lanes: [{ name: 'hg002', label: 'HG002 (son)' }] },
      })
      expect(display.laneStack.lanes[1]!.label).toBe('HG002 (son)')
    })

    test('a held genome draws its lane to the contig end', async () => {
      const { display, contigLine } = await framedDisplay('volvox_random')
      expect(display.laneStack.lanes[1]!.baseline).toEqual(contigLine)
    })

    test('a genome the session does not hold keeps the divider', async () => {
      const { display } = await framedDisplay('hg002')
      expect(display.laneStack.lanes[1]!.baseline).toEqual(DIVIDER)
    })

    test('a genome the session does not hold is never asked of the assembly manager', async () => {
      const asked: string[] = []
      const { display } = await framedDisplay('hg002', {
        assemblyOf: name => {
          asked.push(name)
          return testAssembly()
        },
      })
      expect(display.laneStack.lanes).toHaveLength(2)
      expect(asked).not.toContain('hg002')
    })

    test('a genome still loading keeps the divider until its load redraws the lane', async () => {
      const loaded = observable.box(false)
      const assembly = testAssembly()
      const loading: TestAssembly = {
        ...assembly,
        get regions() {
          return loaded.get() ? assembly.regions : undefined
        },
        get refNameToIndex() {
          return loaded.get() ? assembly.refNameToIndex : undefined
        },
      }
      const { display, contigLine } = await framedDisplay('volvox_random', {
        assemblyOf: name =>
          name === 'volvox_random' ? loading : testAssembly(),
      })
      const baselines: Span[][] = []
      const dispose = autorun(() => {
        baselines.push(display.laneStack.lanes[1]!.baseline)
      })
      expect(baselines.at(-1)).toEqual(DIVIDER)
      runInAction(() => {
        loaded.set(true)
      })
      expect(baselines.at(-1)).toEqual(contigLine)
      dispose()
    })

    test('the anchor lane draws the displayed slice of its contig', () => {
      const display = createDisplay()
      expect(display.laneStack.lanes[0]!.baseline).toEqual([[0, 1000]])
      display.lgv.setDisplayedRegions([
        { refName: 'ctgA', start: 0, end: 300, assemblyName: 'volvox' },
        {
          refName: 'ctgA',
          start: 500,
          end: 800,
          assemblyName: 'volvox',
          reversed: true,
        },
      ])
      const px = (bp: number) => Math.round(bp / display.lgv.bpPerPx)
      expect(display.laneStack.lanes[0]!.baseline).toEqual([
        [0, px(300)],
        [px(300), px(600)],
      ])
    })
  })
})

// `no annotation` in the header is a claim about the SESSION, read off the
// tracks it holds. Asked of this window's genes instead it would blink on and
// off as a lane panned across a gene desert.
test('whether a lane has an annotation is whether the session holds one for it', () => {
  const { lanes } = stack()
  expect(lanes[0]!.hasAnnotation).toBe(true)
  expect(lanes[1]!.hasAnnotation).toBe(false)
})

describe('lane geometry', () => {
  // The bands are what stops the view's gridlines — true on the anchor lane
  // and a lie on every other one — at the anchor. A band covering only its own
  // header and glyphs left them standing in the gutters, which is most of the
  // ink in a tall track.
  test('split strands, the glyph row doubles its cap so each strand keeps the gene height', () => {
    const one = laneGeometry(240, 4)
    const split = laneGeometry(240, 4, true)
    expect(split.glyphHeight).toBe(2 * one.glyphHeight)
    expect(laneGeometry(10 * MIN_LANE_PITCH, 10, true).glyphHeight).toBe(
      laneGeometry(10 * MIN_LANE_PITCH, 10).glyphHeight,
    )
  })

  test('the bands below the anchor tile without gaps', () => {
    const { rows } = laneGeometry(240, 4)
    for (const [row, band] of rows.entries()) {
      if (row > 0) {
        expect(band.bandStart).toBeCloseTo(rows[row - 1]!.bandEnd, 6)
        expect(band.bandStart).toBeLessThan(band.bandTop)
      }
    }
    expect(rows.at(-1)!.bandEnd).toBe(240)
  })

  test('every lane fits inside the stack, at any lane count', () => {
    for (const rowCount of [1, 2, 5, 12]) {
      const { glyphHeight, contentHeight, rows } = laneGeometry(240, rowCount)
      expect(rows).toHaveLength(rowCount)
      expect(rows[0]!.bandTop).toBeGreaterThanOrEqual(0)
      expect(rows.at(-1)!.glyphTop + glyphHeight).toBeLessThanOrEqual(
        contentHeight,
      )
    }
  })

  // The floor is a FLOOR, not a re-layout: at or above MIN_LANE_PITCH per lane
  // the stack is exactly the divide-the-height one and nothing scrolls.
  test('the pitch floor engages exactly where a lane falls under it', () => {
    expect(laneGeometry(10 * MIN_LANE_PITCH, 10).contentHeight).toBe(
      10 * MIN_LANE_PITCH,
    )
    expect(laneGeometry(10 * MIN_LANE_PITCH - 1, 10).contentHeight).toBe(
      10 * MIN_LANE_PITCH,
    )
    expect(laneContentHeight(240, 2)).toBe(240)
    expect(laneContentHeight(240, 20)).toBe(20 * MIN_LANE_PITCH)
  })

  test('below the floor the rows tile the fixed-pitch stack, not the track', () => {
    const { rows, contentHeight } = laneGeometry(240, 20)
    expect(contentHeight).toBe(20 * MIN_LANE_PITCH)
    expect(rows.at(-1)!.bandEnd).toBe(contentHeight)
    for (const [row, band] of rows.entries()) {
      if (row > 0) {
        expect(band.bandStart).toBeCloseTo(rows[row - 1]!.bandEnd, 6)
      }
    }
  })
})

test('every checked-in multiway demo sizes its track to the whole stack', () => {
  for (const demo of ['ecoli_orthologs', 'primate_orthologs', 'hprc']) {
    const config = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, `../../../../demos/${demo}/config.json`),
        'utf8',
      ),
    ) as {
      tracks: {
        assemblyNames: string[]
        displays?: { type: string; height?: number }[]
      }[]
    }
    for (const track of config.tracks) {
      for (const display of track.displays ?? []) {
        if (display.type === 'MultiWaySyntenyDisplay' && display.height) {
          expect(
            laneContentHeight(display.height, track.assemblyNames.length),
          ).toBe(display.height)
        }
      }
    }
  }
})
