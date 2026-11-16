import { MIN_BAND_HEIGHT } from '@jbrowse/core/util/bandHeight'
import { GROW_MAX_HEIGHT } from '@jbrowse/display-kit/heightMode'

import {
  computeStackedSections,
  fittedBelowCoverageHeights,
  laneSlotHeight,
  pileupHiddenBands,
  pileupHiddenHeight,
} from './sectionLayout.ts'

import type { ReadConnectionsMode } from './constants.ts'
import type { BelowCoverageBandsSettings } from './sectionLayout.ts'
import type { HeightMode } from '@jbrowse/display-kit/heightMode'

// A seeded generator, so a failing case names the same lanes on every run.
function seeded(seed: number) {
  let state = seed
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648
    return state / 2_147_483_648
  }
}

const MODES: HeightMode[] = ['fixed', 'fit', 'grow']
const STATED = [0, 5, 20, 45, 120, 5000]
const HEIGHTS = [
  20, 21, 37, 100, 249, 250, 251, 399, 500, 799, 800, 801, 999, 1000,
]
const CONNECTIONS: { mode: ReadConnectionsMode; down: boolean }[] = [
  { mode: 'off', down: false },
  { mode: 'link', down: true },
  { mode: 'link', down: false },
]

// Every band subset: coverage on or off, the connections off, down or up, the
// sashimi strip on or off, each at a stated height from `STATED`.
function* settingsCases(random: () => number) {
  for (const showCoverage of [true, false]) {
    for (const { mode, down } of CONNECTIONS) {
      for (const showSashimi of [true, false]) {
        const pick = () => STATED[Math.floor(random() * STATED.length)]!
        yield {
          showCoverage,
          coverageHeight: pick(),
          drawnReadConnections: mode,
          readConnectionsDown: down,
          readConnectionsHeight: pick(),
          showSashimi,
          sashimiHeight: pick(),
        } satisfies BelowCoverageBandsSettings
      }
    }
  }
}

// The display with its pileup hidden, as the model composes it: each lane's
// slot of the height the mode fits, and the stated stack, bound against that
// height with no row floor, filling it. The booted model's own composition is
// pileupHiddenModel.test.ts's.
function hiddenPileupLayout(
  settings: BelowCoverageBandsSettings,
  lanes: { hasArcs: boolean; hasSashimiDownArcs: boolean }[],
  height: number,
  mode: HeightMode,
) {
  const stated = {
    ...settings,
    hasArcs: lanes.some(l => l.hasArcs),
    hasSashimiDownArcs: lanes.some(l => l.hasSashimiDownArcs),
  }
  const autoHeight = mode === 'grow'
  const budget = pileupHiddenHeight({
    autoHeight,
    fitTargetHeight: height,
    growMaxHeight: GROW_MAX_HEIGHT,
  })
  const input = pileupHiddenBands(stated, budget)
  const slot = laneSlotHeight(budget, lanes.length)
  const layout = computeStackedSections(
    lanes.map((lane, i) => ({
      key: `${i}`,
      maxY: 0,
      heightOverridePx: undefined,
      ...lane,
    })),
    input,
    {
      rowHeight: 10,
      minSectionHeight: slot,
      bandHeights: fittedBelowCoverageHeights(input, slot),
    },
  )
  const displayHeight = autoHeight ? Math.min(budget, GROW_MAX_HEIGHT) : height
  return { slot, layout, displayHeight, stated }
}

// What a lane with coverage draws, from the settings alone: each pooled strip
// at its stated height, top-down, in the room that leaves the coverage
// `MIN_BAND_HEIGHT` of the slot, and the coverage the rest.
function remainderSplit(
  stated: BelowCoverageBandsSettings & {
    hasArcs: boolean
    hasSashimiDownArcs: boolean
  },
  slot: number,
) {
  const room = Math.max(0, slot - MIN_BAND_HEIGHT)
  const arcsStrip =
    stated.drawnReadConnections !== 'off' &&
    stated.readConnectionsDown &&
    stated.hasArcs
  const readConnections = arcsStrip
    ? Math.min(stated.readConnectionsHeight, room)
    : 0
  const sashimi =
    stated.showSashimi && stated.hasSashimiDownArcs
      ? Math.min(stated.sashimiHeight, room - readConnections)
      : 0
  return {
    coverage: slot - readConnections - sashimi,
    readConnections,
    sashimi,
  }
}

function coverageShown(s: BelowCoverageBandsSettings) {
  return s.showCoverage && s.coverageHeight > 0
}

describe('with the pileup hidden the band stack fits the display', () => {
  it('never outgrows it, at any lane count, height, band subset or mode', () => {
    const random = seeded(7)
    const misfits = []
    for (let laneCount = 1; laneCount <= 41; laneCount++) {
      for (const height of HEIGHTS) {
        for (const mode of MODES) {
          for (const settings of settingsCases(random)) {
            const lanes = Array.from({ length: laneCount }, () => ({
              hasArcs: random() < 0.6,
              hasSashimiDownArcs: random() < 0.4,
            }))
            const { slot, layout, displayHeight, stated } = hiddenPileupLayout(
              settings,
              lanes,
              height,
              mode,
            )
            const split = remainderSplit(stated, slot)
            const fits =
              layout.contentHeight <= displayHeight &&
              (laneCount > 1 || layout.contentHeight === displayHeight) &&
              layout.sections.every(
                s => s.height === slot && s.bands.bottom <= slot,
              )
            const coverageTakesTheRest =
              !coverageShown(settings) ||
              layout.sections.every(
                s =>
                  s.bands.reserved.coverage === split.coverage &&
                  [0, split.readConnections].includes(
                    s.bands.reserved.readConnections,
                  ) &&
                  [0, split.sashimi].includes(s.bands.reserved.sashimi),
              )
            if (!fits || !coverageTakesTheRest) {
              misfits.push({ laneCount, height, mode, settings, fits })
            }
          }
        }
      }
    }
    expect(misfits).toEqual([])
  })
})

describe('each lane gets a whole-px slot, its coverage taking what the strips leave', () => {
  const settings: BelowCoverageBandsSettings = {
    showCoverage: true,
    coverageHeight: 45,
    drawnReadConnections: 'link',
    readConnectionsDown: true,
    readConnectionsHeight: 35,
    showSashimi: false,
    sashimiHeight: 40,
  }

  it('splits one lane of 250 px 215/35 between coverage and its arcs', () => {
    const { layout } = hiddenPileupLayout(
      settings,
      [{ hasArcs: true, hasSashimiDownArcs: false }],
      250,
      'fixed',
    )
    expect(layout.sections[0]!.bands.reserved).toEqual({
      coverage: 215,
      readConnections: 35,
      sashimi: 0,
    })
  })

  it('keeps both strips their stated heights under the coverage', () => {
    const { layout } = hiddenPileupLayout(
      { ...settings, showSashimi: true },
      [{ hasArcs: true, hasSashimiDownArcs: true }],
      250,
      'fixed',
    )
    expect(layout.sections[0]!.bands.reserved).toEqual({
      coverage: 175,
      readConnections: 35,
      sashimi: 40,
    })
  })

  it('gives the coverage no say in the split, however tall it is stated', () => {
    const { layout } = hiddenPileupLayout(
      { ...settings, coverageHeight: 5000 },
      [{ hasArcs: true, hasSashimiDownArcs: false }],
      250,
      'fixed',
    )
    expect(layout.sections[0]!.bands.reserved).toEqual({
      coverage: 215,
      readConnections: 35,
      sashimi: 0,
    })
  })

  it('fills the slot in proportion with the coverage off', () => {
    const { layout } = hiddenPileupLayout(
      { ...settings, showCoverage: false, showSashimi: true },
      [{ hasArcs: true, hasSashimiDownArcs: true }],
      250,
      'fixed',
    )
    expect(layout.sections[0]!.bands.reserved).toEqual({
      coverage: 0,
      readConnections: 117,
      sashimi: 133,
    })
  })

  it('leaves a lane with no arcs its full slot, the arcs part blank', () => {
    const { layout } = hiddenPileupLayout(
      settings,
      [
        { hasArcs: true, hasSashimiDownArcs: false },
        { hasArcs: false, hasSashimiDownArcs: false },
      ],
      250,
      'fixed',
    )
    expect(layout.sections.map(s => [s.coverageTop, s.height])).toEqual([
      [0, 125],
      [125, 125],
    ])
    expect(layout.sections.map(s => s.bands.reserved.coverage)).toEqual([
      90, 90,
    ])
    expect(layout.sections[1]!.bands.reserved.readConnections).toBe(0)
  })

  it('overlays up arcs on the stretched coverage, reserving no strip', () => {
    const { layout } = hiddenPileupLayout(
      { ...settings, readConnectionsDown: false },
      [{ hasArcs: true, hasSashimiDownArcs: false }],
      250,
      'fixed',
    )
    const [section] = layout.sections
    expect(section!.bands.reserved.coverage).toBe(250)
    expect(section!.arcBand?.down).toBe(false)
  })

  it('fits grow mode to the track height capped at the grow ceiling', () => {
    expect(
      pileupHiddenHeight({
        autoHeight: true,
        fitTargetHeight: 1000,
        growMaxHeight: 800,
      }),
    ).toBe(800)
    expect(
      pileupHiddenHeight({
        autoHeight: false,
        fitTargetHeight: 1000,
        growMaxHeight: 800,
      }),
    ).toBe(1000)
  })

  // Bound with a row floor, a 60 px track left the arcs 0 px under a 40 px
  // coverage, and a 20 px coverage-only track drew nothing
  it('keeps a short track its strips, leaving the coverage its floor', () => {
    const short = hiddenPileupLayout(
      settings,
      [{ hasArcs: true, hasSashimiDownArcs: false }],
      60,
      'fixed',
    )
    expect(short.layout.sections[0]!.bands.reserved).toEqual({
      coverage: 25,
      readConnections: 35,
      sashimi: 0,
    })
    const shorter = hiddenPileupLayout(
      settings,
      [{ hasArcs: true, hasSashimiDownArcs: false }],
      40,
      'fixed',
    )
    expect(shorter.layout.sections[0]!.bands.reserved).toEqual({
      coverage: MIN_BAND_HEIGHT,
      readConnections: 20,
      sashimi: 0,
    })
    const coverageOnly = hiddenPileupLayout(
      { ...settings, drawnReadConnections: 'off' },
      [{ hasArcs: false, hasSashimiDownArcs: false }],
      20,
      'fixed',
    )
    expect(coverageOnly.layout.sections[0]!.bands.reserved.coverage).toBe(20)
  })

  it('counts no lanes as one', () => {
    expect(laneSlotHeight(250, 0)).toBe(250)
    expect(laneSlotHeight(250, 3)).toBe(83)
  })
})
