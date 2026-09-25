import { SimpleFeature } from '@jbrowse/core/util'
import createJexlInstance from '@jbrowse/core/util/jexl'

import { buildFeatureRenderData } from '../buildFeatureRenderData.ts'
import { UTR_HEIGHT_FRACTION } from '../collect/emitPrimitives.ts'
import { mockDisplayConfig } from '../testUtils.ts'

import type { MockDisplayConfigOverrides } from '../testUtils.ts'
import type { Feature } from '@jbrowse/core/util'

const jexl = createJexlInstance()
const HEIGHT = 10

interface TranscriptSpec {
  id: string
  exons: [number, number][]
  cds?: [number, number][]
}

function transcript({ id, exons, cds = [] }: TranscriptSpec) {
  return {
    uniqueId: id,
    refName: 'chr1',
    start: Math.min(...exons.map(e => e[0])),
    end: Math.max(...exons.map(e => e[1])),
    strand: 1,
    type: 'mRNA',
    subfeatures: [
      ...exons.map(([start, end], i) => ({
        uniqueId: `${id}-exon-${i}`,
        refName: 'chr1',
        start,
        end,
        type: 'exon',
      })),
      ...cds.map(([start, end], i) => ({
        uniqueId: `${id}-cds-${i}`,
        refName: 'chr1',
        start,
        end,
        type: 'CDS',
      })),
    ],
  }
}

function gene(transcripts: TranscriptSpec[]) {
  const rows = transcripts.map(t => transcript(t))
  return new SimpleFeature({
    uniqueId: 'geneA',
    refName: 'chr1',
    start: Math.min(...rows.map(r => r.start)),
    end: Math.max(...rows.map(r => r.end)),
    strand: 1,
    name: 'geneA',
    type: 'gene',
    subfeatures: rows,
  })
}

function render(feature: Feature, overrides: MockDisplayConfigOverrides = {}) {
  return buildFeatureRenderData({
    features: [feature],
    config: mockDisplayConfig({
      featureHeight: HEIGHT,
      geneGlyphMode: 'merged',
      ...overrides,
    }),
    jexl,
    regionStart: 0,
    regionEnd: 1000,
  })
}

// Every box as `[start, end, top, height]`, which is the whole of what a merged
// glyph draws.
function boxes(data: ReturnType<typeof render>) {
  return [...data.rectYs].map((y, i) => [
    data.rectPositions[i * 2]!,
    data.rectPositions[i * 2 + 1]!,
    y,
    data.rectHeights[i]!,
  ])
}

function lines(data: ReturnType<typeof render>) {
  return [...data.lineYs].map((_, i) => [
    data.linePositions[i * 2]!,
    data.linePositions[i * 2 + 1]!,
  ])
}

const UTR_TOP = ((1 - UTR_HEIGHT_FRACTION) / 2) * HEIGHT
const UTR_HEIGHT = HEIGHT * UTR_HEIGHT_FRACTION

test('two transcripts merge into one row of coding and untranslated boxes', () => {
  const data = render(
    gene([
      { id: 'tA', exons: [[100, 300]], cds: [[150, 300]] },
      {
        id: 'tB',
        exons: [
          [100, 300],
          [500, 700],
        ],
        cds: [[500, 650]],
      },
    ]),
  )
  // ascending, the order the parts are packed and painted in
  expect(boxes(data)).toEqual([
    [100, 150, UTR_TOP, UTR_HEIGHT],
    [150, 300, 0, HEIGHT],
    [500, 650, 0, HEIGHT],
    [650, 700, UTR_TOP, UTR_HEIGHT],
  ])
  // one connector across the gap the transcripts leave, and none inside a box
  expect(lines(data)).toEqual([[300, 500]])
})

test('a region coding in any transcript draws full height', () => {
  // tB leaves 400-500 untranslated where tA codes it
  const data = render(
    gene([
      { id: 'tA', exons: [[400, 600]], cds: [[400, 600]] },
      { id: 'tB', exons: [[400, 600]], cds: [[500, 600]] },
    ]),
  )
  expect(boxes(data)).toEqual([[400, 600, 0, HEIGHT]])
})

test('a merged gene draws one row where every transcript draws a row each', () => {
  const transcripts: TranscriptSpec[] = [
    { id: 'tA', exons: [[100, 300]], cds: [[150, 250]] },
    { id: 'tB', exons: [[100, 300]], cds: [[150, 250]] },
    { id: 'tC', exons: [[100, 300]], cds: [[150, 250]] },
  ]
  const merged = render(gene(transcripts))
  const stacked = render(gene(transcripts), { geneGlyphMode: 'all' })
  const bottom = (data: ReturnType<typeof render>) =>
    data.flatbushItems[0]!.bottomPx
  expect(bottom(merged)).toBe(HEIGHT)
  expect(bottom(stacked)).toBeGreaterThan(2 * HEIGHT)
})

test('a merged gene registers no subfeature, and keeps its own hit box and label', () => {
  const data = render(
    gene([
      { id: 'tA', exons: [[100, 300]], cds: [[150, 250]] },
      { id: 'tB', exons: [[500, 700]], cds: [[550, 650]] },
    ]),
    { labels: { name: `jexl:get(feature,'name')`, description: '' } },
  )
  expect(data.subfeatureInfos).toEqual([])
  expect(data.flatbushItems).toHaveLength(1)
  expect(data.flatbushItems[0]).toMatchObject({
    featureId: 'geneA',
    startBp: 100,
    endBp: 700,
    type: 'gene',
  })
  expect(data.floatingLabelsData.get('geneA')?.nameLabel?.text).toBe('geneA')
  // the gene's own direction, drawn once
  expect([...data.arrowXs]).toEqual([700])
})

test('a merged gene still reports the isoforms it merged, so the mode control stays', () => {
  const one = render(gene([{ id: 'tA', exons: [[100, 300]] }]))
  const two = render(
    gene([
      { id: 'tA', exons: [[100, 300]] },
      { id: 'tB', exons: [[100, 300]] },
    ]),
  )
  expect(one.hasMultiIsoformGenes).toBe(false)
  expect(two.hasMultiIsoformGenes).toBe(true)
  // nothing was hidden, so the chip has no pick to name
  expect(two.isoformPicks).toEqual({ byTag: {}, byLength: 0, byCap: 0 })
})

test('a non-coding gene merges its exons at full height', () => {
  const data = render(
    gene([
      {
        id: 'tA',
        exons: [
          [100, 200],
          [300, 400],
        ],
      },
      { id: 'tB', exons: [[150, 250]] },
    ]),
  )
  expect(boxes(data)).toEqual([
    [100, 250, 0, HEIGHT],
    [300, 400, 0, HEIGHT],
  ])
  expect(lines(data)).toEqual([[250, 300]])
})
