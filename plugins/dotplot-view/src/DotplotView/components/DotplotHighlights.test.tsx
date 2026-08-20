import { createJBrowseTheme } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { createTestSession } from '@jbrowse/web/testUtils'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render, screen } from '@testing-library/react'

import DotplotHighlightBands from './DotplotHighlightBands.tsx'
import DotplotHighlightChipOverlay from './DotplotHighlightChipOverlay.tsx'
import DotplotHighlights from './DotplotHighlights.tsx'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

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

  getSession(model).setHighlightsVisible(false)
  rerender(
    <ThemeProvider theme={createJBrowseTheme()}>
      <svg>
        <DotplotHighlights model={model} />
      </svg>
    </ThemeProvider>,
  )
  expect(container.querySelectorAll('rect')).toHaveLength(0)
})

// The chip's menu did nothing at all on click, and the cause is not in the
// menu: the plot takes POINTER CAPTURE on pointerdown for its drag, and a
// captured pointer drags the compatibility mouse events with it, so `click`
// lands on the plot rather than the button. jsdom implements neither capture
// nor that retargeting, so it cannot reproduce the symptom — what is testable
// is the fix, that the press never reaches the plot to start a drag at all.
test('a press on a highlight chip never reaches the plot', () => {
  const model = setup()
  model.addToHighlights({
    refName: 'ctgA',
    start: 100,
    end: 200,
    assemblyName: 'volvox',
  })
  model.setShowHighlightChips(true)
  const onPointerDown = jest.fn()
  const { container } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <div onPointerDown={onPointerDown}>
        <DotplotHighlightChipOverlay model={model} />
      </div>
    </ThemeProvider>,
  )
  const button = container.querySelector('button')!
  fireEvent.pointerDown(button)
  expect(onPointerDown).not.toHaveBeenCalled()

  fireEvent.click(button)
  expect(screen.getByText('Dismiss highlight')).toBeTruthy()
})
