import { EMPTY_ARC_BAND_FEED } from '../../features/arcs/bandFeed.ts'
import { EMPTY_SASHIMI_BAND_FEED } from '../../features/sashimi/bandFeed.ts'
import { makeTestRenderState } from '../testUtils.ts'
import {
  ARC_CLIPPED_MARKS,
  ARC_LINK_MARKS,
  ARC_MARKER_MARK,
} from './arcMarks.ts'
import { forEachBandPass } from './bandPasses.ts'
import { CONNECTOR_MARK, EMPTY_CONNECTOR_FEED } from './connectorMarks.ts'
import { SASHIMI_MARK } from './sashimiMarks.ts'

import type { SectionRender, SectionSource } from './rendererTypes.ts'

interface Recorded {
  section: number
  top: number
  height: number
  spanning: readonly object[]
  perBlock?: { wide: readonly object[]; own: readonly object[] }
}

const SECTION: SectionRender = {
  pileupTopOffset: 100,
  coverageTopOffset: 0,
  covClipTop: 0,
  covClipHeight: 60,
  pileupClipTop: 100,
  pileupClipHeight: 200,
  connectorClipTop: 100,
  connectorClipHeight: 220,
  arcBand: { top: 60, height: 40, down: true },
  sashimiBandTop: 300,
}

function source(over: Partial<SectionSource> = {}): SectionSource {
  return {
    groupKey: '',
    laidOutPileupMap: new Map(),
    arcFeeds: new Map([[0, EMPTY_ARC_BAND_FEED]]),
    sashimiFeeds: new Map([[0, EMPTY_SASHIMI_BAND_FEED]]),
    connectorFeeds: new Map([[0, EMPTY_CONNECTOR_FEED]]),
    ...over,
  }
}

function passesOf(
  sections: SectionSource[],
  sectionRenders: SectionRender[] = sections.map(() => SECTION),
) {
  const state = makeTestRenderState({
    coverage: { height: 60 },
    sashimiHeight: 40,
    sections: sectionRenders,
  })
  const passes: Recorded[] = []
  forEachBandPass(sections, state, {
    visit({ section, top, height, spanning, perBlock }) {
      passes.push({ section, top, height, spanning, perBlock })
    },
  })
  return passes
}

// Both renderers draw exactly this list, so a mark missing from it is missing
// from the screen and the SVG export alike, and no parity test can tell
test('each band draws its own marks, connectors then arcs then sashimi', () => {
  const passes = passesOf([source()])
  expect(passes.map(p => [p.top, p.height, p.spanning, p.perBlock])).toEqual([
    [100, 220, [CONNECTOR_MARK], undefined],
    [
      60,
      40,
      ARC_LINK_MARKS,
      { wide: ARC_CLIPPED_MARKS, own: [ARC_MARKER_MARK] },
    ],
    [0, 60, [SASHIMI_MARK.up], undefined],
    [300, 40, [SASHIMI_MARK.down], undefined],
  ])
})

test('every section draws its connectors before any section draws its arcs', () => {
  const passes = passesOf([source(), source()])
  expect(passes.map(p => [p.section, p.spanning[0]])).toEqual([
    [0, CONNECTOR_MARK],
    [1, CONNECTOR_MARK],
    [0, ARC_LINK_MARKS[0]],
    [1, ARC_LINK_MARKS[0]],
    [0, SASHIMI_MARK.up],
    [0, SASHIMI_MARK.down],
    [1, SASHIMI_MARK.up],
    [1, SASHIMI_MARK.down],
  ])
})

test('a band with no feed or no strip draws nothing', () => {
  const noFeeds = source({
    arcFeeds: new Map(),
    sashimiFeeds: new Map(),
    connectorFeeds: new Map(),
  })
  expect(passesOf([noFeeds])).toEqual([])
  const noStrips: SectionRender = {
    ...SECTION,
    connectorClipHeight: 0,
    arcBand: undefined,
    sashimiBandTop: undefined,
  }
  expect(passesOf([source()], [noStrips]).map(p => p.spanning)).toEqual([
    [SASHIMI_MARK.up],
  ])
})
