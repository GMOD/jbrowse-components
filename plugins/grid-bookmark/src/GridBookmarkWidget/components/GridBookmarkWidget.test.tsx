import { createJBrowseTheme } from '@jbrowse/core/ui'
import { createTestSession } from '@jbrowse/web/testUtils'
import { ThemeProvider } from '@mui/material'
import { render } from '@testing-library/react'

import GridBookmarkWidget from './GridBookmarkWidget.tsx'

import type { GridBookmarkModel } from '../model.ts'

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
  const widget = session.addWidget(
    'GridBookmarkWidget',
    'GridBookmark',
  ) as GridBookmarkModel
  widget.addBookmark({
    assemblyName: 'volvox',
    refName: 'ctgA',
    start: 0,
    end: 100,
  })
  return widget
}

function renderWidget(widget: GridBookmarkModel) {
  return render(
    <ThemeProvider theme={theme}>
      <GridBookmarkWidget model={widget} />
    </ThemeProvider>,
  )
}

test('single grid renders for bookmarks/highlights, two for both', () => {
  const widget = setup()

  widget.setGridView('bookmarks')
  const { container, rerender } = renderWidget(widget)
  expect(container.querySelectorAll('.MuiDataGrid-root')).toHaveLength(1)

  widget.setGridView('both')
  rerender(
    <ThemeProvider theme={theme}>
      <GridBookmarkWidget model={widget} />
    </ThemeProvider>,
  )
  expect(container.querySelectorAll('.MuiDataGrid-root')).toHaveLength(2)
})
