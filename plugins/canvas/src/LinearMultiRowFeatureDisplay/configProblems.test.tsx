import { render, screen } from '@testing-library/react'

import LinearMultiRowFeatureDisplayComponent from './components/LinearMultiRowFeatureDisplayComponent.tsx'
import { createTestEnvironment } from './testEnv.ts'

test('a threshold range that does not fit its cuts shows as a notice', () => {
  const { display } = createTestEnvironment({
    displayConfig: {
      color: {
        field: 'segmean',
        scale: 'threshold',
        domain: ['-1', '1'],
        range: ['blue', 'red'],
      },
    },
  }).createDisplay()
  expect(display.notices).toEqual([
    expect.stringMatching(/^color\.range: 2 threshold cuts make 3 intervals/),
  ])
  render(<LinearMultiRowFeatureDisplayComponent model={display} />)
  expect(screen.getByText('1 config problem')).toBeTruthy()
})
