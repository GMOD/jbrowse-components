import { assemblyArcs, labelsRunAlongArcs } from './rulerLabels.ts'
import { calculateStaticSlices } from './slices.ts'

import type { Slice } from './slices.ts'

function slices(
  regions: { assemblyName: string; refName: string; widthBp: number }[],
) {
  return calculateStaticSlices({
    elidedRegions: regions.map(r => ({
      ...r,
      elided: false as const,
      start: 0,
      end: r.widthBp,
    })),
    bpPerRadian: 1000,
    spacingPx: 0,
    radiusPx: 100,
  })
}

// 100px radius and 1000 bp per radian: a 1000 bp slice is a 100px arc, which
// holds a five-character label along it and not a twenty-character one
test('one label too long for its arc turns every label radial', () => {
  const fits = slices([
    { assemblyName: 'a', refName: 'chr1', widthBp: 1000 },
    { assemblyName: 'a', refName: 'chr2', widthBp: 1000 },
  ])
  expect(labelsRunAlongArcs({ radiusPx: 100, staticSlices: fits })).toBe(true)

  const mixed = slices([
    { assemblyName: 'a', refName: 'chr1', widthBp: 1000 },
    { assemblyName: 'a', refName: 'chrUn_KI270302v1_alt', widthBp: 1000 },
  ])
  expect(labelsRunAlongArcs({ radiusPx: 100, staticSlices: mixed })).toBe(false)
})

test('a circle of one assembly draws no assembly arcs', () => {
  expect(
    assemblyArcs(
      slices([
        { assemblyName: 'hg38', refName: 'chr1', widthBp: 1000 },
        { assemblyName: 'hg38', refName: 'chr2', widthBp: 1000 },
      ]),
    ),
  ).toEqual([])
})

test('each run of one assembly spans its first slice to its last', () => {
  const s: Slice[] = slices([
    { assemblyName: 'hg38', refName: 'chr1', widthBp: 1000 },
    { assemblyName: 'hg38', refName: 'chr2', widthBp: 2000 },
    { assemblyName: 'mm39', refName: 'chr1', widthBp: 3000 },
  ])
  expect(assemblyArcs(s)).toEqual([
    { assemblyName: 'hg38', startRadians: 0, endRadians: 3 },
    { assemblyName: 'mm39', startRadians: 3, endRadians: 6 },
  ])
})
