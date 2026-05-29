import { createJBrowseTheme } from '@jbrowse/core/ui'
// @ts-expect-error
import { createTestSession } from '@jbrowse/web/src/rootModel/index.js'
import { ThemeProvider } from '@mui/material'
import { render } from '@testing-library/react'

import DotplotHighlightBands from './DotplotHighlightBands.tsx'
import DotplotHighlights from './DotplotHighlights.tsx'

jest.mock('@jbrowse/web/src/makeWorkerInstance', () => () => {})

function setup() {
  const session = createTestSession({
    sessionSnapshot: {
      views: [
        {
          type: 'DotplotView',
          height: 600,
          assemblyNames: ['volvox', 'volvox'],
          hview: {
            bpPerPx: 1,
            offsetPx: 0,
            displayedRegions: [
              { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 1000 },
            ],
          },
          vview: {
            bpPerPx: 1,
            offsetPx: 0,
            displayedRegions: [
              { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 1000 },
            ],
          },
        },
      ],
    },
  }) as any
  return session.views[0]
}

function renderSvg(child: React.ReactNode) {
  return render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <svg>{child}</svg>
    </ThemeProvider>,
  )
}

test('self-vs-self region draws both a vertical and horizontal band', () => {
  const model = setup()
  const { container } = renderSvg(
    <DotplotHighlightBands
      model={model}
      region={{ refName: 'ctgA', start: 100, end: 200, assemblyName: 'volvox' }}
      color="red"
    />,
  )
  expect(container.querySelectorAll('rect')).toHaveLength(2)
})

test('off-axis region draws no bands', () => {
  const model = setup()
  const { container } = renderSvg(
    <DotplotHighlightBands
      model={model}
      region={{ refName: 'ctgZ', start: 100, end: 200, assemblyName: 'volvox' }}
      color="red"
    />,
  )
  expect(container.querySelectorAll('rect')).toHaveLength(0)
})

test('native highlights render and respect highlightsVisible', () => {
  const model = setup()
  model.addToHighlights({
    refName: 'ctgA',
    start: 100,
    end: 200,
    assemblyName: 'volvox',
  })
  const { container, rerender } = renderSvg(<DotplotHighlights model={model} />)
  expect(container.querySelectorAll('rect').length).toBeGreaterThan(0)

  model.setHighlightsVisible(false)
  rerender(
    <ThemeProvider theme={createJBrowseTheme()}>
      <svg>
        <DotplotHighlights model={model} />
      </svg>
    </ThemeProvider>,
  )
  expect(container.querySelectorAll('rect')).toHaveLength(0)
})
