import { PaletteProvider } from '@jbrowse/core/ui/PaletteContext'
import { defaultStyleTheme } from '@jbrowse/core/ui/styleTheme'
import { render } from '@testing-library/react'

import { SvgCircularLegend } from './SVGCircularView.tsx'

import type { CircularViewModel } from '../model.ts'
import type { JBrowsePalette } from '@jbrowse/core/ui/palette'

test("the exported key draws in the export's palette, not the session's", () => {
  const model = {
    id: 'view',
    legendSpec: {
      sections: [
        { id: 'tracks', items: [{ label: 'reads', color: '#123456' }] },
      ],
    },
    legendSpecIn: (palette: JBrowsePalette) => ({
      sections: [
        {
          id: 'tracks',
          items: [{ label: 'reads', color: palette.text.primary }],
        },
      ],
    }),
  } as unknown as CircularViewModel
  const exportPalette = {
    ...defaultStyleTheme.palette,
    text: { ...defaultStyleTheme.palette.text, primary: '#abcdef' },
  }
  const { container } = render(
    <PaletteProvider palette={exportPalette}>
      <svg>
        <SvgCircularLegend model={model} size={400} />
      </svg>
    </PaletteProvider>,
  )
  expect(container.innerHTML).toContain('#abcdef')
  expect(container.innerHTML).not.toContain('#123456')
})
