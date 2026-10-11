import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { render, waitFor } from '@testing-library/react'

import BreakpointTooltip from './BreakpointTooltip.tsx'
import { buildPairTooltip } from './overlayUtils.tsx'

// The SAM spec admits `<` and `>` in a QNAME. A reason line used to join the
// tooltip with `<br/>`, which made the sanitizer read `<abc>` as a tag and drop
// it.
test('a read name with angle brackets shows as itself beside a reason', async () => {
  const read = new SimpleFeature({
    uniqueId: 'r1',
    refName: 'chr1',
    start: 0,
    end: 10,
    name: 'read<abc>',
  })
  const { baseElement } = render(
    <BreakpointTooltip
      lines={buildPairTooltip(read, 'chr2:1', ['Read pair'])}
    />,
  )
  await waitFor(() => {
    expect(baseElement.textContent).toContain('Read pair')
  })
  expect(baseElement.textContent).toContain('read<abc>')
})
