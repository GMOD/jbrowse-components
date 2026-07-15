import { createJBrowseTheme } from '@jbrowse/core/ui'
import { createTestSession } from '@jbrowse/web/testUtils'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render, waitFor } from '@testing-library/react'

import LinearGenomeView from './LinearGenomeView.tsx'

import type { LinearGenomeViewModel } from '../model.ts'

// mock
jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

function LGV({ model }: { model: LinearGenomeViewModel }) {
  return (
    <ThemeProvider theme={createJBrowseTheme()}>
      <LinearGenomeView model={model} />
    </ThemeProvider>
  )
}

const assemblyConf = {
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
          end: 10,
          seq: 'cattgttgcg',
        },
      ],
    },
  },
}

test('renders setup wizard', async () => {
  const session = createTestSession()
  session.addAssemblyConf(assemblyConf)
  session.addView('LinearGenomeView', { id: 'lgv' })
  const model = session.views[0]
  model.setWidth(800)
  const { findByText } = render(<LGV model={model} />)
  expect(model.displayedRegions.length).toEqual(0)
  const elt = await findByText('Open', {}, { timeout: 10000 })
  await waitFor(() => {
    expect(elt.getAttribute('disabled')).toBe(null)
  })
  fireEvent.click(elt)
  await waitFor(
    () => {
      expect(model.displayedRegions.length).toEqual(1)
    },
    {
      timeout: 15000,
    },
  )
}, 15000)
