import { createTestSession } from '@jbrowse/web/src/rootModel/index.js'
import { render } from '@testing-library/react'

import DotplotHighlight from './DotplotHighlight.tsx'

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
  const widget = session.addWidget('GridBookmarkWidget', 'GridBookmark')
  widget.addBookmark({
    assemblyName: 'volvox',
    refName: 'ctgA',
    start: 100,
    end: 200,
  })
  return session.views[0]
}

test('bookmark bands render and respect bookmarkHighlightsVisible', () => {
  const model = setup()
  const { container, rerender } = render(
    <svg>
      <DotplotHighlight model={model} />
    </svg>,
  )
  expect(container.querySelectorAll('rect').length).toBeGreaterThan(0)

  model.setBookmarkHighlightsVisible(false)
  rerender(
    <svg>
      <DotplotHighlight model={model} />
    </svg>,
  )
  expect(container.querySelectorAll('rect')).toHaveLength(0)
})
