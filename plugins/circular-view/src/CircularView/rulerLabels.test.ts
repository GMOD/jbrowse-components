import {
  assemblyArcs,
  labelWidthPx,
  labelsRunAlongArcs,
} from './rulerLabels.ts'
import { buildChordAxis, layoutSlices } from './slices.ts'

import type { Slice } from './slices.ts'

function slices(
  regions: { assemblyName: string; refName: string; widthBp: number }[],
) {
  return layoutSlices(
    buildChordAxis(
      regions.map(r => ({
        ...r,
        elided: false as const,
        start: 0,
        end: r.widthBp,
      })),
    ),
    { radiansPerBp: 1 / 1000, gapRadians: 0 },
  )
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

// widths of 'chr13_random' at weight 500, 13px, measured with Skia against the
// faces fontconfig resolves `serif` and `sans-serif` to, plus the 0.0075em
// tracking per glyph the label is drawn with. The Helvetica table alone puts it
// at 83.6px, so a label measured there ran off the export's edge
test.each([
  ['Noto Serif', 'serif', 91.8],
  ['DejaVu Serif', 'serif', 95.7],
  ['Noto Sans', 'sans-serif', 89.8],
  ['DejaVu Sans', 'sans-serif', 94.2],
])('a label is reserved its width as %s draws it', (_face, family, drawnPx) => {
  const text = 'chr13_random'
  const trackingPx = text.length * 0.0075 * 13
  expect(labelWidthPx(text, family)).toBeGreaterThanOrEqual(
    drawnPx + trackingPx,
  )
})
