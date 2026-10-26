import { render } from '@testing-library/react'

import AlignmentsTooltip from './AlignmentsTooltip.tsx'
import { formatConnectorTooltip } from './tooltipUtils.ts'

import type { ColorPalette } from '../../shaders/colors.ts'
import type { TooltipPayload } from './tooltipUtils.ts'

function renderTip(payload: TooltipPayload) {
  return render(
    <AlignmentsTooltip
      model={{
        mouseoverExtraInformation: payload,
        hoverCoverageBand: undefined,
        themed: { colors: {} as ColorPalette },
        baseLayer: undefined,
      }}
      mouseState={{ x: 0, y: 0, clientX: 0, clientY: 0 }}
    />,
  )
}

// The SAM spec admits `<`, `>` and `&` in a QNAME. The connector tooltip used
// to escape the name into an HTML string that `SanitizedHTML` then judged to be
// plain text, so `read&lt;abc&gt;` reached the screen literally.
test.each<[string, TooltipPayload]>([
  [
    'a read tooltip',
    { type: 'text', title: 'read<abc>&b', lines: ['MAPQ: 60'] },
  ],
  [
    'a connector tooltip',
    formatConnectorTooltip({ label: 'Read pair', id1: 'a', id2: 'b' }, id => ({
      id,
      name: 'read<abc>&b',
      refName: 'chr1',
      start: 0,
      end: 10,
      strand: 1,
    })),
  ],
])('%s shows a read name with markup characters as itself', (_, tip) => {
  const { getByTestId } = renderTip(tip)
  expect(getByTestId('pileup-tooltip').textContent).toContain('read<abc>&b')
})
