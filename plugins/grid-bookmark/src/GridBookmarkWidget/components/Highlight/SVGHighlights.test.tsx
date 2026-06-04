import { createJBrowseTheme } from '@jbrowse/core/ui'
import { SVGHighlights } from '@jbrowse/plugin-linear-genome-view'
import { createTestSession } from '@jbrowse/web/testUtils'
import { ThemeProvider } from '@mui/material'
import { render } from '@testing-library/react'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

const theme = createJBrowseTheme()

function setup() {
  const session = createTestSession({
    sessionSnapshot: {
      views: [
        {
          type: 'LinearGenomeView',
          bpPerPx: 1,
          offsetPx: 0,
          displayedRegions: [
            { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 1000 },
          ],
        },
      ],
    },
  }) as any
  const model = session.views[0]
  model.addToHighlights({
    assemblyName: 'volvox',
    refName: 'ctgA',
    start: 100,
    end: 200,
    label: 'my region',
  })
  return model
}

test('native highlight bands render and respect highlightsVisible', () => {
  const model = setup()
  const { container, rerender } = render(
    <ThemeProvider theme={theme}>
      <svg>
        <SVGHighlights model={model} height={100} />
      </svg>
    </ThemeProvider>,
  )
  expect(container.querySelectorAll('rect').length).toBeGreaterThan(0)
  expect(container.textContent).toContain('my region')

  model.setHighlightsVisible(false)
  rerender(
    <ThemeProvider theme={theme}>
      <svg>
        <SVGHighlights model={model} height={100} />
      </svg>
    </ThemeProvider>,
  )
  expect(container.querySelectorAll('rect')).toHaveLength(0)
})
