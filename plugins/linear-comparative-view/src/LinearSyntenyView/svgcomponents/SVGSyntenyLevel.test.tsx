import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { render } from '@testing-library/react'

import SVGSyntenyLevel from './SVGSyntenyLevel.tsx'

// Two synteny tracks in one level, as a level with two SyntenyTracks between the
// same pair of assemblies has. Both paint the same full-height band, so where
// the error chrome sits decides whether one track's 404 erases the other.
function renderLevel(error?: unknown) {
  return render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <svg>
        <SVGSyntenyLevel
          clipId="test-clip"
          width={800}
          levelHeight={100}
          trackLabelOffset={0}
          error={error}
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

test('paints every display in the level when none errored', () => {
  const { queryByTestId, container } = renderLevel()
  expect(queryByTestId('ribbons-a')).toBeTruthy()
  expect(queryByTestId('ribbons-b')).toBeTruthy()
  expect(container.textContent).not.toContain('boom')
})

test('one error box for the level, not one per display', () => {
  // regression: each display used to wrap itself in SvgChrome, so an errored
  // display painted an opaque box over its siblings' ribbons
  const { queryByTestId, container } = renderLevel('boom\nkaboom')
  expect(container.textContent).toContain('boom')
  expect(container.querySelectorAll('rect[fill="#ffdddd"]')).toHaveLength(1)
  expect(queryByTestId('ribbons-a')).toBeNull()
  expect(queryByTestId('ribbons-b')).toBeNull()
})

test('keeps the color-by legend outside the error chrome and the clip', () => {
  // the legend is the view's key, not the track's, so an errored level still
  // documents what the other levels' colors mean
  const { container } = renderLevel('boom')
  expect(container.textContent).toContain('legend')
})
