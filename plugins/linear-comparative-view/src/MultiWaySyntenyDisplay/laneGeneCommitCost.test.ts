import { setConf } from '@jbrowse/core/configuration'
import { SimpleFeature } from '@jbrowse/core/util'
import { autorun } from 'mobx'

import { LaneGene } from './geneGlyph.ts'
import { createDisplayWithSession } from './testEnv.ts'

import type { MultiWaySyntenyDisplayModel } from './model.ts'

const evaluations = { color: 0, utrColor: 0 }
jest.mock('@jbrowse/core/configuration', () => {
  const actual = jest.requireActual('@jbrowse/core/configuration')
  return {
    ...actual,
    readConfObject: (conf: unknown, slot: unknown, args: unknown) => {
      if (Array.isArray(slot) && slot[0] === 'color' && slot[1] === 'value') {
        evaluations.color++
      } else if (slot === 'utrColor') {
        evaluations.utrColor++
      }
      return actual.readConfObject(conf, slot, args)
    },
  }
})

const LANES = 44
const GENES_PER_LANE = 30
const laneNames = Array.from({ length: LANES }, (_, i) => `strain${i}`)

function laneGenes(lane: string, tag = '') {
  return Array.from(
    { length: GENES_PER_LANE },
    (_, i) =>
      new LaneGene(
        new SimpleFeature({
          uniqueId: `${lane}-g${i}${tag}`,
          name: `sym${i}`,
          refName: 'ctgB',
          start: 20_000 + i * 25,
          end: 20_000 + i * 25 + 20,
          strand: 1,
          type: 'gene',
          subfeatures: [
            {
              uniqueId: `${lane}-g${i}${tag}-cds`,
              refName: 'ctgB',
              start: 20_000 + i * 25 + 5,
              end: 20_000 + i * 25 + 15,
              type: 'CDS',
            },
            {
              uniqueId: `${lane}-g${i}${tag}-utr`,
              refName: 'ctgB',
              start: 20_000 + i * 25,
              end: 20_000 + i * 25 + 5,
              type: 'five_prime_UTR',
            },
          ],
        }),
      ),
  )
}

async function until(cond: () => boolean) {
  for (let i = 0; i < 200 && !cond(); i++) {
    await new Promise(r => setTimeout(r, 5))
  }
  expect(cond()).toBe(true)
}

function glyphCellsOf(cells: ReadonlyMap<string, unknown>) {
  return new Map([...cells].filter(([key]) => /^(glyphs|boxes):/.test(key)))
}

function changedKeys(
  before: ReadonlyMap<string, unknown>,
  after: ReadonlyMap<string, unknown>,
) {
  return [...after.keys()].filter(key => after.get(key) !== before.get(key))
}

// Forty-four lanes of thirty genes, one ortholog group per lane stacking five
// placements, with both colour slots per-feature jexl
async function stackWithGenes() {
  const { display } = createDisplayWithSession({
    trackAssemblyNames: ['volvox', ...laneNames],
    geneTracks: [],
    rpc: () => new Promise(() => {}),
  })
  setConf(
    display,
    'color',
    "jexl:feature.name ? randomColor(feature.name) : '#b0b0b0'",
  )
  setConf(
    display,
    'utrColor',
    "jexl:feature.strand > 0 ? '#357089' : '#893570'",
  )
  display.setFeatures(
    laneNames.flatMap((lane, li) =>
      [100, 250, 400, 550, 700].map(
        (s, gi) =>
          new SimpleFeature({
            uniqueId: `${lane}-${gi}`,
            name: `sym${gi}`,
            refName: 'ctgA',
            start: s,
            end: s + 60,
            strand: 1,
            mate: {
              assemblyName: lane,
              refName: 'ctgB',
              start: 20_000 + s + li,
              end: 20_060 + s + li,
            },
          }),
      ),
    ),
  )
  await until(() => display.laneDecisions.size === LANES)
  let cells: ReadonlyMap<string, unknown> = new Map()
  const stop = autorun(() => {
    cells = display.namedCells
  })
  display.setLaneGenes(
    new Map(
      laneNames.map(lane => [lane, { key: 'k0', genes: laneGenes(lane) }]),
    ),
    display.anchorAssemblyName,
  )
  return { display, cells: () => cells, stop }
}

function rowOf(display: MultiWaySyntenyDisplayModel, assemblyName: string) {
  return display.laneStack.lanes.findIndex(
    lane => lane.assemblyName === assemblyName,
  )
}

// One lane's gene commit re-created every lane's glyph and box cells and ran
// both colour slots over every lane's genes: 90 of 90 cells and 1,325 `color`
// evaluations at this size. The stack reads no genes, so the commit leaves
// every other `Lane` as it was, and a cell keeps its identity, and so its
// upload, while its lane, fills and ink do
test("one lane's gene commit repacks that lane alone", async () => {
  const { display, cells, stop } = await stackWithGenes()
  const lane = laneNames[7]!
  const row = rowOf(display, lane)
  const before = cells()
  expect(glyphCellsOf(before).size).toBe(2 * (LANES + 1))

  evaluations.color = 0
  evaluations.utrColor = 0
  display.setLaneGenes(
    new Map([[lane, { key: 'k1', genes: laneGenes(lane, 'x') }]]),
    undefined,
  )
  expect(changedKeys(before, cells()).sort()).toEqual(
    [`boxes:${row}`, `glyphs:${row}`].sort(),
  )
  expect(evaluations).toEqual({
    color: GENES_PER_LANE,
    utrColor: GENES_PER_LANE,
  })
  stop()
})

// A settle hands every lane a new `Lane`, so every cell is repacked, against
// the fills its lane already resolved
test('a settle repacks every lane and evaluates no colour slot', async () => {
  const { display, cells, stop } = await stackWithGenes()
  const before = glyphCellsOf(cells())

  evaluations.color = 0
  evaluations.utrColor = 0
  display.setLaneFrames(
    display.renderOriginPx + 10,
    new Map(display.laneDecisions),
  )
  expect(changedKeys(before, glyphCellsOf(cells())).length).toBe(before.size)
  expect(evaluations).toEqual({ color: 0, utrColor: 0 })
  stop()
})

// The fills are keyed on the colour setting's raw values, so a new setting
// repacks every lane under it
test('a colour setting repacks every lane', async () => {
  const { display, cells, stop } = await stackWithGenes()
  const before = glyphCellsOf(cells())

  display.setGeneColorBy('cluster')
  expect(changedKeys(before, glyphCellsOf(cells())).length).toBe(before.size)
  stop()
})
