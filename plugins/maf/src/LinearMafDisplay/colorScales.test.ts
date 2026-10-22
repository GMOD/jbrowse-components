import { resolvePalette } from '@jbrowse/core/ui/palette'
import { colorEncodingOf } from '@jbrowse/display-kit/colorConfigSchema'

import { mafColorScales } from './colorScales.ts'
import { MAF_FIELD_PRESETS } from './mafColorConfigSchema.ts'

import type { MafColorScaleInputs } from './colorScales.ts'
import type { MafColorField } from './rowRenderings.ts'
import type { ColorScale } from '@jbrowse/core/ui/colorScale'

function inputs(
  field: MafColorField,
  overrides: Partial<MafColorScaleInputs> = {},
): MafColorScaleInputs {
  return {
    palette: resolvePalette(),
    rendering: field,
    rowsColor: field,
    colorEncoding: colorEncodingOf(
      {
        field,
        value: undefined,
        scale: { type: undefined, domain: [], range: [] },
        legend: {},
      },
      MAF_FIELD_PRESETS,
    )!,
    colorKeyTitle: 'Key',
    oneBaseCells: false,
    maxSourceChromRank: 3,
    showsFrames: false,
    rowColorScales: [],
    ...overrides,
  }
}

const ids = (scales: ColorScale[]) => scales.map(s => s.id)

test('a rendering keys itself, then frames, then the row colors', () => {
  const rowKey: ColorScale = {
    kind: 'categorical',
    id: 'rows',
    title: 'Rows',
    entries: [],
  }
  expect(
    ids(
      mafColorScales(
        inputs('codon', { showsFrames: true, rowColorScales: [rowKey] }),
      ),
    ),
  ).toEqual(['codon', 'cdsFrame', 'rows'])
})

test('chromosome keys one entry per rank', () => {
  const [scale] = mafColorScales(
    inputs('chromosome', { maxSourceChromRank: 2 }),
  )
  expect(scale!.id).toBe('sourceChrom')
  expect(scale!.kind === 'categorical' && scale!.entries.length).toBe(3)
})

test('identity color keys the heatmap whichever rendering draws it', () => {
  expect(
    ids(mafColorScales(inputs('identity', { rendering: 'xyplot' }))),
  ).toEqual(['heatmap'])
})

test('an xyplot over a non-identity color keys the bars alone', () => {
  const [scale] = mafColorScales(inputs('mismatch', { rendering: 'xyplot' }))
  expect(scale!.id).toBe('xyplot')
})

test('a rendering with no key of its own adds none', () => {
  expect(mafColorScales(inputs('mismatch'))).toEqual([])
})
