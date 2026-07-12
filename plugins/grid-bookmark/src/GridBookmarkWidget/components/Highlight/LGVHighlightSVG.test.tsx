import { createTestSession } from '@jbrowse/web/testUtils'
import { render } from '@testing-library/react'

import LGVHighlightSVG from './LGVHighlightSVG.tsx'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

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
  const widget = session.addWidget('GridBookmarkWidget', 'GridBookmark')
  widget.addBookmark({
    assemblyName: 'volvox',
    refName: 'ctgA',
    start: 100,
    end: 200,
  })
  return { model: session.views[0], widget }
}

test('bookmark bands render and respect bookmarkHighlightsVisible', () => {
  const { model, widget } = setup()
  const { container, rerender } = render(
    <svg>
      <LGVHighlightSVG model={model} height={100} />
    </svg>,
  )
  expect(container.querySelectorAll('rect').length).toBeGreaterThan(0)

  widget.setBookmarkHighlightsVisible(false)
  rerender(
    <svg>
      <LGVHighlightSVG model={model} height={100} />
    </svg>,
  )
  expect(container.querySelectorAll('rect')).toHaveLength(0)
})
