import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { abgrToHex, normalizedRgbToHex } from '@jbrowse/core/util/colorBits'
import AlignmentsPlugin, {
  isLinearAlignmentsDisplay,
} from '@jbrowse/plugin-alignments'

import { arcColorSlot } from '../../../../plugins/alignments/src/features/arcs/arcColors.ts'
import {
  connectorArrowPx,
  connectorInstance,
  linePassInstance,
} from '../../../../plugins/alignments/src/features/linkedReads/connectorFeed.ts'
import { effectiveBaseColors } from '../../../../plugins/alignments/src/features/mismatch/baseColors.ts'
import { junctionColor } from '../../../../plugins/alignments/src/features/sashimi/bandFeed.ts'
import { buildArcColorPalette } from '../../../../plugins/alignments/src/shaders/palettes.ts'
import { CONNECTOR_BOW } from '../../../render-core/src/shaders/connectorMark.consts.generated.ts'
import { createTablesEngine } from '../index.ts'
import { BAM, PAIRED_INVERSION, SPLICED } from '../volvox.fixture.ts'
import { standUpDisplay } from './testEnv.ts'
import { parityCases } from './testUtils.ts'

import type { AlignmentTables } from '../index.ts'
import type { ParityAdapter } from './testUtils.ts'
import type { TablesRegion } from '@jbrowse/core/data_adapters/tables'
import type { LinearAlignmentsDisplayModel } from '@jbrowse/plugin-alignments/LinearAlignmentsDisplay/stateModel'

interface GeometryFixture {
  adapterConfig: Record<string, unknown>
  region: TablesRegion
}

const GEOMETRY_DECISIONS = [
  'sections',
  'rows',
  'connectors',
  'dipReserve',
  'junctions',
  'arcs',
  'mismatchColors',
] as const

type GeometryDecision = (typeof GEOMETRY_DECISIONS)[number]

const VOLVOX_CONTIG = 50_001

const volvoxBam = (file: string) => {
  const uri = (name: string) => ({
    uri: pathToFileURL(path.resolve('test_data/volvox', name)).href,
    locationType: 'UriLocation',
  })
  return {
    type: 'BamAdapter',
    bamLocation: uri(file),
    index: { location: uri(`${file}.bai`), indexType: 'BAI' },
  }
}

/** Simulated short reads over a tandem duplication: split reads map back. */
const TANDEM_DUPLICATION = {
  adapterConfig: volvoxBam('volvox-sv.bam'),
  region: { refName: 'ctgA', start: 41000, end: 44000 },
}

const engine = createTablesEngine()

const sorted = (entries: string[]) => entries.toSorted()

interface Window {
  start: number
  end: number
}

/** Whether a span, its ends in either order, reaches into `window`. */
const touches = (window: Window, a = 0, b = a) =>
  Math.max(a, b) > window.start && Math.min(a, b) < window.end

/**
 * Whether the window shows read `i` of `d`: it touches the window, or a
 * connector the window draws joins it, partly off screen.
 */
const readShown = (
  window: Window,
  joined: ReadonlySet<unknown>,
  d: { readPositions: ArrayLike<number>; readKeys: ArrayLike<unknown> },
  i: number,
) =>
  touches(window, d.readPositions[2 * i], d.readPositions[2 * i + 1]) ||
  joined.has(d.readKeys[i])

/** Each drawn read the window shows, its section and row by its read key. */
function readRows(
  sections: LinearAlignmentsDisplayModel['renderSections'],
  shown: (
    d: { readPositions: ArrayLike<number>; readKeys: ArrayLike<unknown> },
    i: number,
  ) => boolean,
) {
  const rows: Record<string, string> = {}
  for (const sec of sections) {
    for (const d of sec.laidOutPileupMap.values()) {
      for (let i = 0; i < d.readKeys.length; i++) {
        if (shown(d, i)) {
          rows[String(d.readKeys[i])] = `${sec.label}:${d.readYs[i]}`
        }
      }
    }
  }
  return rows
}

/**
 * What the alignments display draws of its pileup's geometry in `window`,
 * read off the model as its renderers read it: each drawn read's section and
 * row, every connector the line pass and the connector mark draw, each
 * section's dip reserve, the junctions the sashimi band draws and their
 * color, the arcs the read-connection band draws, and the color each
 * mismatched base paints. The display lays out the view's margin around the
 * window too, which the window does not show.
 */
function modelGeometry(m: LinearAlignmentsDisplayModel, window: Window) {
  const sections = m.renderSections
  const labelOf = new Map(sections.map(s => [s.groupKey, s.label]))
  const palette = m.themed.colors
  const rowPitch = m.featureHeight + m.featureSpacing
  const arrows = connectorArrowPx(m.featureHeight) > 0
  const { displayedRegions } = m.view
  const straightLines = [...m.connectorsByGroup].flatMap(([key, { lines }]) =>
    [...lines.values()].flatMap(l =>
      Array.from({ length: l.numLinkedReadLines }, (_, i) =>
        touches(
          window,
          l.linkedReadLinePositions[2 * i],
          l.linkedReadLinePositions[2 * i + 1],
        )
          ? [
              `${labelOf.get(key)} ${l.linkedReadLinePositions[2 * i]}-${l.linkedReadLinePositions[2 * i + 1]} ${l.linkedReadLineYs[2 * i]}/${l.linkedReadLineYs[2 * i + 1]} straight`,
            ]
          : [],
      ).flat(),
    ),
  )
  const joined = new Set<unknown>()
  for (const sec of sections) {
    const group = m.connectorsByGroup.get(sec.groupKey)
    const placedPairs = [
      ...(group?.linePairs ?? []).map(pair => ({
        pair,
        placed: linePassInstance(
          pair,
          displayedRegions,
          sec.pileupHeight,
          rowPitch,
        ),
      })),
      ...(group?.overlayPairs ?? []).map(pair => ({
        pair,
        placed: connectorInstance(
          pair,
          displayedRegions,
          sec.pileupHeight,
          rowPitch,
          arrows,
        ),
      })),
    ]
    for (const { pair, placed } of placedPairs) {
      if (placed && touches(window, placed.x, placed.x2)) {
        joined.add(pair.e1.data.readKeys[pair.e1.readIdx])
        joined.add(pair.e2.data.readKeys[pair.e2.readIdx])
      }
    }
  }
  const shown = (
    d: { readPositions: ArrayLike<number>; readKeys: ArrayLike<unknown> },
    i: number,
  ) => readShown(window, joined, d, i)
  const marked = m.connectorPairSections.flatMap(sec =>
    sec.pairs.flatMap(pair => {
      const placed = connectorInstance(
        pair,
        displayedRegions,
        sec.pileupHeight,
        rowPitch,
        arrows,
      )
      const label = labelOf.get(sec.groupKey)
      return placed && touches(window, placed.x, placed.x2)
        ? [
            placed.straight
              ? `${label} ${placed.x}-${placed.x2} ${placed.row}/${placed.row2} straight`
              : `${label} ${pair.e1.data.readKeys[pair.e1.readIdx]}>${pair.e2.data.readKeys[pair.e2.readIdx]} ${placed.row}/${placed.row2} ${placed.loop ? 'loop' : 'curve'} ${placed.bend === CONNECTOR_BOW ? 0 : placed.bend}`,
          ]
        : []
    }),
  )
  const arcSlotColor = buildArcColorPalette(palette).map(normalizedRgbToHex)
  const baseColors = effectiveBaseColors(m.renderState)
  return {
    sections: sections.map(s => s.label),
    rows: m.showPileup ? readRows(sections, shown) : {},
    connectors: sorted([...straightLines, ...marked]),
    dipReserve: Object.fromEntries(sections.map(s => [s.label, s.dipReserve])),
    junctions: Object.fromEntries(
      m.sashimiJunctionSections.flatMap(sec =>
        sec.junctions.map(j => [
          `${labelOf.get(sec.groupKey)} ${j.refName}:${j.start}-${j.end}`,
          abgrToHex(junctionColor(j, palette)),
        ]),
      ),
    ),
    arcs: sorted(
      [...m.arcsResult.byGroup].flatMap(([key, byRegion]) =>
        [...byRegion.values()].flatMap(a =>
          Array.from({ length: a.numArcs }, (_, i) =>
            touches(window, a.arcX1[i], a.arcX2[i])
              ? [
                  `${labelOf.get(key)} ${a.arcX1[i]}-${a.arcX2[i]} ${arcSlotColor[arcColorSlot(a.arcColorTypes[i]!)]}`,
                ]
              : [],
          ).flat(),
        ),
      ),
    ),
    mismatchColors:
      m.showPileup && m.showMismatches
        ? Object.fromEntries(
            sections.flatMap(sec =>
              [...sec.laidOutPileupMap.values()].flatMap(d =>
                Array.from(d.mismatchBases, (b, k) => {
                  const base = String.fromCodePoint(b)
                  const rgb =
                    base in baseColors
                      ? baseColors[base as keyof typeof baseColors]
                      : baseColors.N
                  return shown(d, d.mismatchReadIndices[k]!)
                    ? [[base, normalizedRgbToHex(rgb)]]
                    : []
                }).flat(),
              ),
            ),
          )
        : {},
  }
}

/** The same decisions as the tables state them. */
function exportGeometry(t: AlignmentTables) {
  const idOfKey = new Map(t.reads.key.map((k, i) => [k, t.reads.id[i]!]))
  const c = t.connectors
  const j = t.junctions
  return {
    sections: t.sections.label,
    rows: Object.fromEntries(
      t.reads.id.map((id, i) => [
        id,
        `${t.reads.section[i]}:${t.reads.row[i]}`,
      ]),
    ),
    connectors: sorted(
      c.kind.map((kind, i) =>
        kind === 'straight'
          ? `${c.section[i]} ${c.start[i]}-${c.end[i]} ${c.row[i]}/${c.endRow[i]} straight`
          : `${c.section[i]} ${idOfKey.get(c.key[i]!)}>${idOfKey.get(c.mateKey[i]!)} ${c.row[i]}/${c.endRow[i]} ${kind} ${c.dip[i]}`,
      ),
    ),
    dipReserve: Object.fromEntries(
      t.sections.label.map((label, i) => [label, t.sections.dipReserve[i]]),
    ),
    junctions: Object.fromEntries(
      j.start.flatMap((start, i) =>
        j.shown[i]
          ? [
              [
                `${j.section[i]} ${j.refName[i]}:${start}-${j.end[i]}`,
                j.color[i],
              ],
            ]
          : [],
      ),
    ),
    arcs: sorted(
      t.arcs.start.map(
        (start, i) =>
          `${t.arcs.section[i]} ${start}-${t.arcs.end[i]} ${t.arcs.color[i]}`,
      ),
    ),
    mismatchColors: Object.fromEntries(
      t.mismatches.base.map((base, i) => [base, t.mismatches.color[i]]),
    ),
  }
}

/**
 * The alignments display's pileup geometry beside `engine.alignments` over
 * one fixture. A lane the viewport's row budget clips lays out differently
 * by design (the tables lay every row out), so a case clipping one fails
 * here rather than comparing rows.
 */
function geometryParity(
  fixture: GeometryFixture,
): ParityAdapter<
  Record<string, unknown>,
  LinearAlignmentsDisplayModel,
  AlignmentTables,
  GeometryDecision
> {
  return {
    decisionNames: GEOMETRY_DECISIONS,
    buildModel: async display => {
      const { display: model, dispose } =
        await standUpDisplay<LinearAlignmentsDisplayModel>({
          plugins: [new AlignmentsPlugin()],
          track: { type: 'AlignmentsTrack', adapter: fixture.adapterConfig },
          displayType: 'LinearAlignmentsDisplay',
          isDisplay: isLinearAlignmentsDisplay,
          displayConfig: display,
          region: fixture.region,
          contigLength: VOLVOX_CONTIG,
          bpPerPx: (fixture.region.end - fixture.region.start) / 1000,
        })
      const clipped = model.lanes.filter(
        l => l.clippedBy !== undefined && l.clippedBy !== 'collapse',
      )
      if (clipped.length > 0) {
        dispose()
        throw new Error(
          `the view's row budget clips ${clipped.map(l => l.label).join(', ')}; give the case a taller track`,
        )
      }
      return { model, dispose }
    },
    buildExport: display =>
      engine.alignments({
        adapterConfig: fixture.adapterConfig,
        region: fixture.region,
        display,
      }),
    modelDecisions: m => modelGeometry(m, fixture.region),
    exportDecisions: exportGeometry,
  }
}

const TALL = { height: 2000 }

describe('volvox reads', () => {
  parityCases(geometryParity(BAM), [
    { name: 'defaults', config: TALL },
    {
      name: 'a column sort',
      config: { ...TALL, sort: { field: 'base', pos: 2500, refName: 'ctgA' } },
    },
    { name: 'a whole-window sort', config: { ...TALL, sort: 'length' } },
    { name: 'facet by strand', config: { ...TALL, facet: 'strand' } },
    {
      name: 'facet by strand, collapsed to one row',
      config: { ...TALL, facet: 'strand', pileup: { collapsed: true } },
    },
    {
      name: 'facet by strand, collapsed, pileup connectors',
      config: {
        ...TALL,
        facet: 'strand',
        pileup: { collapsed: true, connectors: { show: true } },
      },
    },
    {
      name: 'no pileup, the coverage alone',
      config: { ...TALL, pileup: { show: false } },
    },
    {
      name: 'pileup connectors',
      config: { ...TALL, pileup: { connectors: { show: true } } },
    },
    { name: 'unit chain', config: { ...TALL, unit: 'chain' } },
  ])
})

describe('volvox pairs across an inversion', () => {
  parityCases(geometryParity(PAIRED_INVERSION), [
    {
      name: 'unit chain, read connections',
      config: { ...TALL, unit: 'chain', readConnections: { show: true } },
    },
    {
      name: 'read connections as a read cloud',
      config: {
        ...TALL,
        readConnections: { show: true, mark: { type: 'rule' } },
      },
    },
    {
      name: 'pileup connectors',
      config: { ...TALL, pileup: { connectors: { show: true } } },
    },
  ])
})

describe('split reads over a tandem duplication', () => {
  parityCases(geometryParity(TANDEM_DUPLICATION), [
    {
      name: 'unit chain: reads that map back loop',
      config: { ...TALL, unit: 'chain' },
    },
    {
      name: 'pileup connectors',
      config: { ...TALL, pileup: { connectors: { show: true } } },
    },
  ])
})

describe('spliced reads', () => {
  parityCases(geometryParity(SPLICED), [
    { name: 'defaults', config: TALL },
    {
      name: 'facet by strand',
      config: { ...TALL, facet: 'strand' },
    },
  ])
})

test('the cases decide over loops, curves, straight lines, junctions, arcs and a dip reserve', async () => {
  const [loops, pairs, spliced, arcs] = await Promise.all([
    engine.alignments({ ...TANDEM_DUPLICATION, display: { unit: 'chain' } }),
    engine.alignments({
      ...PAIRED_INVERSION,
      display: { pileup: { connectors: { show: true } } },
    }),
    engine.alignments({ ...SPLICED, display: {} }),
    engine.alignments({
      ...PAIRED_INVERSION,
      display: { readConnections: { show: true } },
    }),
  ])
  expect(loops.connectors.kind).toContain('loop')
  expect(pairs.connectors.kind).toContain('curve')
  expect(pairs.connectors.kind).toContain('straight')
  expect(Math.max(...pairs.sections.dipReserve)).toBeGreaterThan(0)
  expect(spliced.junctions.shown).toContain(true)
  expect(arcs.arcs.start.length).toBeGreaterThan(0)
}, 60_000)
