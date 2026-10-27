import { createJBrowseTheme } from '@jbrowse/core/ui'
import { createTestSession } from '@jbrowse/web/testUtils'
import { ThemeProvider } from '@mui/material'
import { render, screen } from '@testing-library/react'

import GridBookmarkWidget from './GridBookmarkWidget.tsx'

import type { GridBookmarkModel } from '../model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

test('the list shows each highlight with its label', async () => {
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
  })
  session.addHighlight({
    assemblyName: 'volvox',
    refName: 'ctgA',
    start: 0,
    end: 100,
    label: 'first region',
  })
  const widget = session.addWidget(
    'GridBookmarkWidget',
    'GridBookmark',
  ) as GridBookmarkModel
  render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <GridBookmarkWidget model={widget} />
    </ThemeProvider>,
  )
  expect(await screen.findByText('first region')).toBeTruthy()
  expect(screen.getByText('ctgA:1..100')).toBeTruthy()
})
