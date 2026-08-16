import { render, screen } from '@testing-library/react'

import FeatureTooltip from './FeatureTooltip.tsx'

const at = { x: 10, y: 10, clientX: 10, clientY: 10 }

// The rows are separate elements, so `SanitizedHTML` decides markup-or-text
// about each one on its own. Joined with a generated `<br/>`, the whole string
// read as markup and DOMPurify dropped the allele — a variant tooltip that read
// `ALT <DEL>` on its own lost it the moment an exon row appeared beside it.
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

// Both halves matter and neither implies the other: `mouseState` is undefined
// after a leave as well as on the first render after a status banner clears, and
// an empty row list is a hit whose feature had nothing to say.
test('draws nothing without a pointer', () => {
  render(<FeatureTooltip rows={['BRCA1']} mouseState={undefined} />)
  expect(screen.queryByText('BRCA1')).toBeNull()
})

test('draws nothing for a hit with no rows', () => {
  render(<FeatureTooltip rows={[]} mouseState={at} />)
  expect(document.body.textContent).toBe('')
})
