import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { render } from '@testing-library/react'

import SVGSyntenyLevel from './SVGSyntenyLevel.tsx'

// Two synteny tracks in one level, as a level with two SyntenyTracks between the
// same pair of assemblies has. Both paint the same full-height band, which is
// why the level draws no terminal-state chrome of its own — there is nowhere to
// put a box that isn't over whichever tracks did render. A failed track fails
// the export instead, so this component only ever sees ribbons that rendered.
function renderLevel() {
  return render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <svg>
        <SVGSyntenyLevel
          clipId="test-clip"
          width={800}
          levelHeight={100}
          trackLabelOffset={0}
          rendering={[
            { key: 'a', node: <rect data-testid="ribbons-a" /> },
            { key: 'b', node: <rect data-testid="ribbons-b" /> },
          ]}
          legend={<text>legend</text>}
        />
      </svg>
    </ThemeProvider>,
  )
}

test('paints every display in the level', () => {
  const { queryByTestId } = renderLevel()
  expect(queryByTestId('ribbons-a')).toBeTruthy()
  expect(queryByTestId('ribbons-b')).toBeTruthy()
})

test('keeps the color-by legend outside the clip', () => {
  // a legend taller than a short level would otherwise be cropped by the band's
  // clip rect
  const { container } = renderLevel()
  const clipped = container.querySelector('g[clip-path]')
  expect(clipped?.textContent).not.toContain('legend')
  expect(container.textContent).toContain('legend')
})
