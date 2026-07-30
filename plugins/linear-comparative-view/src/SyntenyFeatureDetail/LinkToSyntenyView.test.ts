import { findAnchorAssembly } from './LinkToSyntenyView.tsx'

import type { SyntenyFeatureDetailModel } from './types.ts'

// A plain LGV, reached via LGVSyntenyDisplay's own context menu: no rows to
// index, so the view's own assembly is the anchor.
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

test('uses the LGV assembly when opened from LGVSyntenyDisplay (no level)', () => {
  const model = {
    view: lgv(['volvox']),
    level: undefined,
  } as unknown as SyntenyFeatureDetailModel
  expect(findAnchorAssembly(model)).toBe('volvox')
})

test('uses the row at `level`, not the outer union, when opened from a ribbon click', () => {
  const model = {
    view: syntenyView([['volvox'], ['volvox2']]),
    level: 1,
  } as unknown as SyntenyFeatureDetailModel
  expect(findAnchorAssembly(model)).toBe('volvox2')
})

test('does not fall back to feature.assemblyName: a missing row resolves to undefined', () => {
  const model = {
    view: syntenyView([['volvox']]),
    level: 5,
  } as unknown as SyntenyFeatureDetailModel
  expect(findAnchorAssembly(model)).toBeUndefined()
})
