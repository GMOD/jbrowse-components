import { createJBrowseTheme } from '@jbrowse/core/ui'
import { createTestSession } from '@jbrowse/web/testUtils'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import RangeSelectOverlay from './RangeSelectOverlay.tsx'

import type { LinearGenomeViewModel } from '../model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

test('a picked range-menu row closes the menu once', async () => {
  const session = createTestSession()
  session.addAssemblyConf({
    name: 'volMyt1',
    sequence: {
      trackId: 'sequenceConfigId',
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          {
            refName: 'ctgA',
            uniqueId: 'firstId',
            start: 0,
            end: 1000,
            seq: 'cattgttgcg'.repeat(100),
          },
        ],
      },
    },
  })
  session.addView('LinearGenomeView', {
    displayedRegions: [
      { refName: 'ctgA', start: 0, end: 1000, assemblyName: 'volMyt1' },
    ],
  })
  const model = session.views[0] as LinearGenomeViewModel
  model.setWidth(800)
  await waitFor(() => {
    expect(model.initialized).toBe(true)
  })
  model.setOffsets(model.pxToBp(100), model.pxToBp(200))

  const handleClose = jest.fn()
  render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <RangeSelectOverlay
        model={model}
        range={{
          isClick: false,
          guideX: undefined,
          rubberband: undefined,
          anchorPosition: {
            offsetX: 200,
            clientX: 200,
            clientY: 50,
            isClick: false,
          },
          mouseDown: () => {},
          mouseMove: () => {},
          mouseOut: () => {},
          handleClose,
        }}
      />
    </ThemeProvider>,
  )
  fireEvent.click(await screen.findByText('Zoom to region'))
  expect(handleClose).toHaveBeenCalledTimes(1)
})
