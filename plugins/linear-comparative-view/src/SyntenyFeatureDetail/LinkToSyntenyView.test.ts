import { SimpleFeature } from '@jbrowse/core/util'

import { anchorRow, launchAnchor } from './LinkToSyntenyView.tsx'

import type { SyntenyFeatureDetailModel } from './types.ts'
import type { AssemblyHost } from '@jbrowse/core/util'

// A plain LGV, reached via LGVSyntenyDisplay's own context menu: no rows to
// index, so the view itself is the anchor.
function lgv(assemblyNames: string[]) {
  return { type: 'LinearGenomeView', assemblyNames }
}

// The outer LinearSyntenyView, reached via a ribbon click: `level` says which
// row-pair produced the feature.
function syntenyView(rowAssemblyNames: string[][]) {
  return {
    type: 'LinearSyntenyView',
    views: rowAssemblyNames.map(assemblyNames => ({ assemblyNames })),
  }
}

test('the LGV is its own anchor when opened from LGVSyntenyDisplay (no level)', () => {
  const view = lgv(['volvox'])
  const model = {
    view,
    level: undefined,
  } as unknown as SyntenyFeatureDetailModel
  expect(anchorRow(model)).toBe(view)
})

test('the row at `level`, not the outer view, when opened from a ribbon click', () => {
  const view = syntenyView([['volvox'], ['volvox2']])
  const model = { view, level: 1 } as unknown as SyntenyFeatureDetailModel
  expect(anchorRow(model)?.assemblyNames).toEqual(['volvox2'])
})

test('a missing row is no anchor: nothing falls back to the outer view', () => {
  const view = syntenyView([['volvox']])
  expect(
    anchorRow({ view, level: 5 } as unknown as SyntenyFeatureDetailModel),
  ).toBeUndefined()
  expect(
    anchorRow({
      view,
      level: undefined,
    } as unknown as SyntenyFeatureDetailModel),
  ).toBeUndefined()
})

// the ribbon's own side anchors, in the assembly's canonical name, and the
// circle hands each genome's row the tracks it shows for that genome
test('a circle ribbon anchors on its own genome with the circle tracks for both', () => {
  const view = {
    type: 'CircularView',
    id: 'circle',
    assemblyNames: ['hg38', 'mm39'],
    linearTracksFor: (name: string) => [{ trackId: `${name}-genes` }],
  }
  const host = {
    assemblyManager: {
      get: (name: string) => ({ name: name === 'GRCh38' ? 'hg38' : name }),
    },
  } as unknown as AssemblyHost
  const feature = new SimpleFeature({
    uniqueId: 'aln1',
    assemblyName: 'GRCh38',
    refName: 'chr1',
    start: 100,
    end: 200,
    mate: { assemblyName: 'mm39', refName: 'chr4', start: 300, end: 400 },
  })
  expect(
    launchAnchor(
      { view } as unknown as SyntenyFeatureDetailModel,
      host,
      feature,
    ),
  ).toEqual({
    viewId: 'circle',
    assembly: 'hg38',
    tracks: [{ trackId: 'hg38-genes' }],
    mateTracks: { mm39: [{ trackId: 'mm39-genes' }] },
    region: undefined,
  })
})

test('a circle ribbon names no anchor: the circular view has no linear row', () => {
  const view = { type: 'CircularView', assemblyNames: ['volvox', 'volvox2'] }
  expect(
    anchorRow({ view } as unknown as SyntenyFeatureDetailModel),
  ).toBeUndefined()
})
