import { SimpleFeature } from '@jbrowse/core/util'
import { getFeatureName } from '@jbrowse/plugin-canvas'

import { LaneGene } from './geneGlyph.ts'
import { placeLaneLabels } from './laneLabels.ts'

function gene(name: string, start: number, end: number) {
  return new LaneGene(
    new SimpleFeature({ uniqueId: name, refName: 'chr1', start, end, name }),
  )
}

function lane(assemblyName: string, glyphTop: number) {
  return {
    assemblyName,
    glyphTop,
    spanOf: (_refName: string, start: number, end: number) =>
      [start, end] as [number, number],
  }
}

function place(genes: Record<string, LaneGene[]>, lanes = [lane('a', 20)]) {
  return placeLaneLabels({
    lanes,
    genesOf: name => genes[name] ?? [],
    textOf: getFeatureName,
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

  it('labels every lane, each under its own glyphs', () => {
    const labels = placeLaneLabels({
      lanes: [lane('a', 20), lane('b', 60)],
      genesOf: () => [gene('G', 400, 500)],
      textOf: getFeatureName,
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

  it('leaves out a nameless gene and one off the canvas', () => {
    expect(place({ a: [gene('', 100, 200), gene('OFF', 2000, 2100)] })).toEqual(
      [],
    )
  })

  it('names a placement box standing in for a gene the lane lacks', () => {
    const labels = placeLaneLabels({
      lanes: [lane('a', 20)],
      genesOf: () => [gene('G', 100, 200)],
      textOf: getFeatureName,
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

  it("keeps a pinned group's name however crowded, ahead of its neighbours", () => {
    const genes = [
      gene('A', 100, 110),
      gene('CROWDED', 112, 114),
      gene('B', 116, 200),
    ]
    const labels = placeLaneLabels({
      lanes: [lane('a', 20)],
      genesOf: () => genes,
      textOf: getFeatureName,
      groupsOf: () => new Map([['CROWDED', 'g1']]),
      pinnedGroups: new Set(['g1']),
      glyphHeight: 10,
      width: 1000,
      height: 200,
      fontFamily: 'sans-serif',
    })
    expect(labels.map(l => [l.text, l.pinned])).toEqual([
      ['CROWDED', true],
      ['B', false],
    ])
  })
})
