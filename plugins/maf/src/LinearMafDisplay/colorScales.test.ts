import { resolvePalette } from '@jbrowse/core/ui/palette'
import { colorEncodingOf } from '@jbrowse/display-kit/colorConfigSchema'

import { mafColorScales } from './colorScales.ts'
import { MAF_FIELD_PRESETS } from './mafColorConfigSchema.ts'

import type { MafColorScaleInputs } from './colorScales.ts'
import type { MafColorField, RowPlan } from './rowPlan.ts'
import type { ColorScale } from '@jbrowse/core/ui/colorScale'

const CELLS: RowPlan = {
  mark: 'rect',
  color: undefined,
  mismatches: true,
  bases: undefined,
  perBase: true,
}

function inputs(
  field: MafColorField | undefined,
  plan: Partial<RowPlan> = {},
  overrides: Partial<MafColorScaleInputs> = {},
): MafColorScaleInputs {
  return {
    palette: resolvePalette(),
    plan: { ...CELLS, color: field, ...plan },
    colorEncoding: colorEncodingOf(
      {
        field: field ?? '',
        value: undefined,
        scale: { type: undefined, domain: [], range: [] },
        legend: {},
      },
      MAF_FIELD_PRESETS,
    ),
    colorKeyTitle: 'Key',
    oneBaseCells: false,
    maxSourceChromRank: 3,
    showsFrames: false,
    rowColorScales: [],
    ...overrides,
  }
}

const ids = (scales: ColorScale[]) => scales.map(s => s.id)

test('the fill keys itself, then the codon layer, frames and row colors', () => {
  const rowKey: ColorScale = {
    kind: 'categorical',
    id: 'rows',
    title: 'Rows',
    entries: [],
  }
  expect(
    ids(
      mafColorScales(
        inputs(
          'identity',
          { bases: 'codon' },
          { showsFrames: true, rowColorScales: [rowKey] },
        ),
      ),
    ),
  ).toEqual(['heatmap', 'codon', 'cdsFrame', 'rows'])
})

test('refNameRank keys one entry per rank', () => {
  const [scale] = mafColorScales(
    inputs('refNameRank', {}, { maxSourceChromRank: 2 }),
  )
  expect(scale!.id).toBe('sourceChrom')
  expect(scale!.kind === 'categorical' && scale!.entries.length).toBe(3)
})

test('an identity fill keys its ramp under the bars too', () => {
  expect(ids(mafColorScales(inputs('identity', { mark: 'bar' })))).toEqual([
    'heatmap',
  ])
})

test('bars under a constant fill key their height', () => {
  const [scale] = mafColorScales(inputs(undefined, { mark: 'bar' }))
  expect(scale!.id).toBe('xyplot')
})

test('a constant fill with the mismatches over it keys nothing', () => {
  expect(mafColorScales(inputs(undefined))).toEqual([])
})
