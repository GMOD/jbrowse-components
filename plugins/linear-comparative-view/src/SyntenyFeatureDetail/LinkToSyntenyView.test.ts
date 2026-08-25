import { anchorRow } from './LinkToSyntenyView.tsx'

import type { SyntenyFeatureDetailModel } from './types.ts'

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
