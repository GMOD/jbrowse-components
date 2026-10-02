import { render, screen } from '@testing-library/react'

import VariantDisplayComponent from '../LinearMultiSampleVariantDisplay/components/VariantDisplayComponent.tsx'
import { createTestEnvironment as createMatrixTestEnvironment } from '../LinearMultiSampleVariantDisplay/matrix/testEnv.ts'
import { createTestEnvironment } from '../LinearMultiSampleVariantDisplay/testEnv.ts'

const MISFIT_THRESHOLD = {
  color: {
    field: 'INFO.DP',
    scale: 'threshold',
    domain: ['10', '20'],
    range: ['red', 'blue'],
  },
}

test.each([
  ['genomic', createTestEnvironment],
  ['columns', createMatrixTestEnvironment],
])(
  'a threshold range that does not fit its cuts is a notice in the %s layout',
  (_layout, environment) => {
    const { display } = environment({
      displayConfig: MISFIT_THRESHOLD,
    }).createDisplay()
    expect(display.notices).toEqual([
      expect.stringMatching(/^color\.range: 2 threshold cuts make 3 intervals/),
    ])
    render(<VariantDisplayComponent model={display} />)
    expect(screen.getByText('1 config problem')).toBeTruthy()
  },
)

test('a colour that paints as written has no notice', () => {
  const { display } = createTestEnvironment().createDisplay()
  expect(display.notices).toEqual([])
  render(<VariantDisplayComponent model={display} />)
  expect(screen.queryByText(/config problem/)).toBeNull()
})
