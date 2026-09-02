import { createJBrowseTheme } from '@jbrowse/core/ui'
import { OverlayPointerProvider } from '@jbrowse/core/ui/highlightChipReveal'
import { getSession } from '@jbrowse/core/util'
import { createTestSessionAsync } from '@jbrowse/web/testUtils'
import { ThemeProvider } from '@mui/material'
import { act, fireEvent, render, screen } from '@testing-library/react'

import DotplotHighlightBands from './DotplotHighlightBands.tsx'
import DotplotHighlightChipOverlay from './DotplotHighlightChipOverlay.tsx'
import DotplotHighlights from './DotplotHighlights.tsx'
import { useDotplotInteraction } from './useDotplotInteraction.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

async function setup() {
  const session = (await createTestSessionAsync({
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
  })) as any
  return session.views[0]
}

function renderSvg(child: React.ReactNode) {
  return render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <svg>{child}</svg>
    </ThemeProvider>,
  )
}

test('self-vs-self region draws both a vertical and horizontal band', async () => {
  const model = await setup()
  const { container } = renderSvg(
    <DotplotHighlightBands
      model={model}
      region={{ refName: 'ctgA', start: 100, end: 200, assemblyName: 'volvox' }}
      color="red"
    />,
  )
  expect(container.querySelectorAll('rect')).toHaveLength(2)
})

test('off-axis region draws no bands', async () => {
  const model = await setup()
  const { container } = renderSvg(
    <DotplotHighlightBands
      model={model}
      region={{ refName: 'ctgZ', start: 100, end: 200, assemblyName: 'volvox' }}
      color="red"
    />,
  )
  expect(container.querySelectorAll('rect')).toHaveLength(0)
})

test('native highlights render and respect highlightsVisible', async () => {
  const model = await setup()
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
test('a press on a highlight chip never reaches the plot', async () => {
  const model = await setup()
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

// The plot's own pointer stream is what a band's chip reveals off, so the
// harness publishes it the way DotplotView does rather than standing up its own
// tracker — a copy would pass with the view wired to nothing.
function Plot({ model }: { model: any }) {
  const interaction = useDotplotInteraction(model)
  return (
    <div data-testid="plot" {...interaction.containerProps}>
      <OverlayPointerProvider value={interaction.mouseTracker}>
        <DotplotHighlightChipOverlay model={model} />
      </OverlayPointerProvider>
    </div>
  )
}

// the tracked position is published in a frame, so give that frame back before
// asking what the bands drew
async function movePointerTo(element: Element, x: number, y: number) {
  await act(async () => {
    fireEvent.pointerMove(element, { clientX: x, clientY: y })
    await new Promise(resolve => {
      requestAnimationFrame(() => {
        resolve(undefined)
      })
    })
  })
}

function chips() {
  return screen.queryAllByTestId('highlight-chip')
}

test('each axis band reveals its own chip under the pointer', async () => {
  const model = await setup()
  const highlight = {
    refName: 'ctgA',
    start: 100,
    end: 200,
    assemblyName: 'volvox',
  }
  model.addToHighlights(highlight)
  // the same region lands on both axes here (self-vs-self), so the two chips
  // are independent answers rather than one drawn twice
  const h = model.getHHighlightCoords(highlight)!
  const v = model.getVHighlightCoords(highlight)!
  render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <Plot model={model} />
    </ThemeProvider>,
  )
  const plot = screen.getByTestId('plot')
  expect(chips()).toHaveLength(0)

  // inside the x-axis band's column, clear of the y-axis band's row
  await movePointerTo(plot, h.left + h.width / 2, v.top + v.height + 50)
  expect(chips()).toHaveLength(1)

  // inside the y-axis band's row, clear of the x-axis band's column
  await movePointerTo(plot, h.left + h.width + 50, v.top + v.height / 2)
  expect(chips()).toHaveLength(1)

  // their intersection is where the drag that made the highlight was: both
  await movePointerTo(plot, h.left + h.width / 2, v.top + v.height / 2)
  expect(chips()).toHaveLength(2)

  await movePointerTo(plot, h.left + h.width + 50, v.top + v.height + 50)
  expect(chips()).toHaveLength(0)
})

test('showHighlightChips pins both chips with no pointer anywhere near them', async () => {
  const model = await setup()
  model.addToHighlights({
    refName: 'ctgA',
    start: 100,
    end: 200,
    assemblyName: 'volvox',
  })
  model.setShowHighlightChips(true)
  render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <Plot model={model} />
    </ThemeProvider>,
  )
  expect(chips()).toHaveLength(2)
})
