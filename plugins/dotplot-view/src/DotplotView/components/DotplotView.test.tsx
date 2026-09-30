import { createJBrowseTheme } from '@jbrowse/core/ui'
import { createTestSession } from '@jbrowse/web/testUtils'
import { ThemeProvider } from '@mui/material'
import { render, screen } from '@testing-library/react'
import { when } from 'mobx'

import DotplotView from './DotplotView.tsx'

import type { DotplotViewModel } from '../model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

async function setup() {
  const session = createTestSession() as any
  session.addAssemblyConf({
    name: 'volvox',
    sequence: {
      trackId: 'volvox_refseq',
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          {
            refName: 'ctgA',
            uniqueId: 'ctgA',
            start: 0,
            end: 1000,
            seq: 'a'.repeat(1000),
          },
        ],
      },
    },
  })
  const view = (await session.launchView('DotplotView', {
    views: [{ assembly: 'volvox' }, { assembly: 'volvox' }],
  })) as DotplotViewModel
  view.setWidth(800)
  await when(() => view.initialized)
  return view
}

test('the legend follows the plot overlay, so it wins their shared z-index', async () => {
  const view = await setup()
  view.setColorField('strand')
  render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <DotplotView model={view} />
    </ThemeProvider>,
  )
  const legend = await screen.findByTestId('floating-legend')
  const canvas = screen.getByTestId('dotplot_webgl_canvas')
  expect(
    canvas.compareDocumentPosition(legend) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy()
})
