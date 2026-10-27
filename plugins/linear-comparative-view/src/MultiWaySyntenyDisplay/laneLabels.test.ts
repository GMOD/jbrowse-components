import { SimpleFeature } from '@jbrowse/core/util'
import { measureText } from '@jbrowse/core/util/measureText'
import { getFeatureName } from '@jbrowse/plugin-features'

import { LaneGene } from './geneGlyph.ts'
import { GENE_LABEL_FONT_PX, placeLaneLabels } from './laneLabels.ts'
import { frameSpans } from './layoutMultiWay.ts'
import { drawnLeftPx } from './multiwayRenderTypes.ts'

import type { RowFrame } from './layoutMultiWay.ts'
import type { Feature } from '@jbrowse/core/util'

function labelOf(feature: Feature) {
  const name = getFeatureName(feature)
  return name
    ? { name, width: measureText(name, GENE_LABEL_FONT_PX, 'sans-serif') }
    : undefined
}

function gene(name: string, start: number, end: number) {
  return new LaneGene(
    new SimpleFeature({ uniqueId: name, refName: 'chr1', start, end, name }),
  )
}

function lane(assemblyName: string, glyphTop: number) {
  return {
    assemblyName,
    glyphTop,
    spansOf: (_refName: string, start: number, end: number) => [
      [start, end] as const,
    ],
  }
}

function place(genes: Record<string, LaneGene[]>, lanes = [lane('a', 20)]) {
  return placeLaneLabels({
    lanes,
    genesOf: name => genes[name] ?? [],
    labelOf,
    glyphHeight: 10,
    width: 1000,
    height: 200,
    fontFamily: 'sans-serif',
  }).map(l => l.text)
}

describe('placeLaneLabels', () => {
  it('names an isolated gene however narrow', () => {
    expect(place({ a: [gene('LONGNAME', 500, 502)] })).toEqual(['LONGNAME'])
  })

  it("drops a name its neighbours' edges leave no room for", () => {
    expect(
      place({
        a: [
          gene('A', 100, 110),
          gene('CROWDED', 112, 114),
          gene('B', 116, 200),
        ],
      }),
    ).toEqual(['A', 'B'])
  })

  // CAT draws HG00128#1's GSTM2 as a 41 kb transcript running through GSTM1;
  // GSTM1's room ended at GSTM2's right edge, behind GSTM1's own left
  it("names a gene inside another gene's span", () => {
    expect(
      place({
        a: [
          gene('GSTM2', 100, 600),
          gene('GSTM1', 300, 360),
          gene('GSTM5', 610, 700),
        ],
      }),
    ).toEqual(['GSTM2', 'GSTM1', 'GSTM5'])
  })

  // A nested gene's label starts at its own left edge, so the room it needs
  // runs from there, not from the name before the gene around it
  it("leaves a nested gene unnamed rather than overrunning its neighbour's name", () => {
    expect(
      place({
        a: [
          gene('OUTER', 100, 600),
          gene('NESTEDLONGNAME', 570, 590),
          gene('C', 610, 700),
        ],
      }),
    ).toEqual(['OUTER', 'C'])
  })

  it('labels every lane, each under its own glyphs', () => {
    const labels = placeLaneLabels({
      lanes: [lane('a', 20), lane('b', 60)],
      genesOf: () => [gene('G', 400, 500)],
      labelOf,
      glyphHeight: 10,
      width: 1000,
      height: 200,
      fontFamily: 'sans-serif',
    })
    expect(labels.map(l => [l.key, l.top])).toEqual([
      ['a:G', 31],
      ['b:G', 71],
    ])
  })

  it("starts a name at its gene's left edge, as a feature track does", () => {
    const [label] = placeLaneLabels({
      lanes: [lane('a', 20)],
      genesOf: () => [gene('Nnt', 200, 900)],
      labelOf,
      glyphHeight: 10,
      width: 1000,
      height: 200,
      fontFamily: 'sans-serif',
    })
    expect(label!.left).toBe(200)
  })

  it('holds a name on screen under a gene that starts off the left edge', () => {
    const [label] = placeLaneLabels({
      lanes: [lane('a', 20)],
      genesOf: () => [gene('Nnt', -500, 900)],
      labelOf,
      glyphHeight: 10,
      width: 1000,
      height: 200,
      fontFamily: 'sans-serif',
    })
    expect(label!.left).toBeGreaterThanOrEqual(0)
    expect(label!.left).toBeLessThan(10)
  })

  it('labels a gene cut by a hole on its widest drawn piece', () => {
    // HG00099#1's AMYP1: one exon before a 94 kb deletion, six after it
    const frame: RowFrame = {
      refName: 'chr1',
      min: 0,
      max: 150_000,
      flipped: false,
      fitMin: 0,
      fitMax: 150_000,
      alsoOn: [],
      alsoOnMore: 0,
      alsoAt: [],
      openings: [{ at: 50_000, bp: 94_000 }],
    }
    const [label] = placeLaneLabels({
      lanes: [
        {
          assemblyName: 'a',
          glyphTop: 20,
          spansOf: (_refName, start, end) =>
            frameSpans(frame, start, end, 2000),
        },
      ],
      genesOf: () => [gene('AMYP1', 49_000, 55_000)],
      labelOf,
      glyphHeight: 10,
      width: 2000,
      height: 200,
      fontFamily: 'sans-serif',
    })
    expect(label!.left).toBeCloseTo(1920)
  })

  it('leaves out a nameless gene and one off the canvas', () => {
    expect(place({ a: [gene('', 100, 200), gene('OFF', 2000, 2100)] })).toEqual(
      [],
    )
  })

  it('names a placement box standing in for a gene the lane lacks', () => {
    const labels = placeLaneLabels({
      lanes: [lane('a', 20)],
      genesOf: () => [gene('G', 100, 200)],
      labelOf,
      boxesOf: () => [
        { id: 'box:g', name: 'Potri.001G', left: 500, right: 600 },
      ],
      glyphHeight: 10,
      width: 1000,
      height: 200,
      fontFamily: 'sans-serif',
    })
    expect(labels.map(l => l.text)).toEqual(['G', 'Potri.001G'])
  })

  it("keeps a pinned group's name however crowded, and slides a neighbour past it", () => {
    const genes = [
      gene('A', 100, 110),
      gene('CROWDED', 112, 114),
      gene('B', 116, 200),
    ]
    const labels = placeLaneLabels({
      lanes: [lane('a', 20)],
      genesOf: () => genes,
      labelOf,
      groupsOf: () => new Map([['CROWDED', 'g1']]),
      pinnedGroups: new Set(['g1']),
      glyphHeight: 10,
      width: 1000,
      height: 200,
      fontFamily: 'sans-serif',
    })
    expect(labels.map(l => [l.text, l.pinned])).toEqual([
      ['A', false],
      ['CROWDED', true],
      ['B', false],
    ])
  })

  // HG00128#1 at GSTT1, in the figure's css px: GSTT3P's name at its own left
  // edge covered the left edge of GSTT2, which sits inside it
  it('slides a blocked name along its own gene, the tightest fit placed first', () => {
    const labels = placeLaneLabels({
      lanes: [lane('a', 20)],
      genesOf: () => [
        gene('GSTT2B', 156, 198),
        gene('DDTL', 256, 279),
        gene('DDT', 295, 330),
        gene('GSTT3P', 350, 499),
        gene('GSTT2', 386, 428),
        gene('GSTT4', 560, 638),
      ],
      labelOf,
      glyphHeight: 10,
      width: 1296,
      height: 200,
      fontFamily: 'sans-serif',
    })
    expect(labels.map(l => [l.text, Math.round(l.left)])).toEqual([
      ['GSTT2B', 156],
      ['DDTL', 256],
      ['DDT', 295],
      ['GSTT2', 386],
      ['GSTT3P', 420],
      ['GSTT4', 560],
    ])
  })

  it('places a hovered name first, at its start, however much room it has', () => {
    const labels = placeLaneLabels({
      lanes: [lane('a', 20)],
      genesOf: () => [gene('GSTT3P', 350, 499), gene('GSTT2', 386, 428)],
      labelOf,
      groupsOf: () => new Map([['GSTT3P', 'g1']]),
      pinnedGroups: new Set(['g1']),
      glyphHeight: 10,
      width: 1296,
      height: 200,
      fontFamily: 'sans-serif',
    })
    expect(labels.map(l => [l.text, Math.round(l.left)])).toEqual([
      ['GSTT3P', 350],
      ['GSTT2', 395],
    ])
  })

  it('drops a blocked name once its gene has no free slot left', () => {
    expect(
      place({ a: [gene('OUTERGENE', 100, 200), gene('INNERGENE', 110, 175)] }),
    ).toEqual(['INNERGENE'])
  })
})

test('a label on a lane mid-flip starts at its box’s left end on screen', () => {
  const mirror = { scale: -1, offset: 800 }
  expect(drawnLeftPx(mirror, 100, 40)).toBe(660)
  expect(drawnLeftPx({ scale: 1, offset: 0 }, 100, 40)).toBe(100)
})
