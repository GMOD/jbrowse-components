import { ExportFontFamilyContext } from '@jbrowse/core/svg/constants'
import { render } from '@testing-library/react'

import GroupLabelBox from './GroupLabelBox.tsx'
import {
  GROUP_LABEL_FONT_SIZE,
  GROUP_LABEL_PADDING_X,
} from './groupLabelStyle.ts'

// A monospace face advances every glyph 0.6em, where the Helvetica table puts
// `i` at 0.22em: measured there, the pill ended inside its own name
test('an export in monospace sizes the pill to its name in that face', () => {
  const text = 'iiiiiiiiiiii'
  const { container } = render(
    <svg>
      <ExportFontFamilyContext value="monospace">
        <GroupLabelBox x={0} y={0} text={text} />
      </ExportFontFamilyContext>
    </svg>,
  )
  const pill = Number(container.querySelector('rect')!.getAttribute('width'))
  expect(pill).toBeGreaterThanOrEqual(
    text.length * 0.6 * GROUP_LABEL_FONT_SIZE + 2 * GROUP_LABEL_PADDING_X,
  )
})
