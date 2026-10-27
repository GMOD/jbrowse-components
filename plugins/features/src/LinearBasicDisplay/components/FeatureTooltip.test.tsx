import { render, screen } from '@testing-library/react'

import FeatureTooltip from './FeatureTooltip.tsx'

const at = { x: 10, y: 10, clientX: 10, clientY: 10 }

test('keeps angle-bracket text that is not markup, alongside a second row', async () => {
  render(
    <FeatureTooltip rows={['ALT <DEL>', 'exon 2/3 c.11']} mouseState={at} />,
  )
  expect(await screen.findByText('ALT <DEL>')).toBeTruthy()
  expect(screen.getByText('exon 2/3 c.11')).toBeTruthy()
})

test('renders markup a mouseover slot returned', async () => {
  render(<FeatureTooltip rows={['<b>BRCA1</b>']} mouseState={at} />)
  expect(await screen.findByText('BRCA1')).toBeTruthy()
})

test('draws nothing without a pointer', () => {
  render(<FeatureTooltip rows={['BRCA1']} mouseState={undefined} />)
  expect(screen.queryByText('BRCA1')).toBeNull()
})

test('draws nothing for a hit with no rows', () => {
  render(<FeatureTooltip rows={[]} mouseState={at} />)
  expect(document.body.textContent).toBe('')
})
