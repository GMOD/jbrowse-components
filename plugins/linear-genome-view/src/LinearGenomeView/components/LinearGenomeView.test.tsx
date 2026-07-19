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

test('import form renders before the view width is measured', async () => {
  const session = createTestSession()
  session.addAssemblyConf(assemblyConf)
  session.addView('LinearGenomeView', { id: 'lgv' })
  const model = session.views[0]
  // deliberately do NOT setWidth. In the import-form state model.initialized
  // reduces to "has a width been measured", but the form does not depend on
  // width; previously the whole form was gated on model.initialized and stayed
  // blank until the container measured a width
  const { findByText } = render(<LGV model={model} />)
  expect(model.initialized).toBe(false)

  // the assembly selector and Open button render regardless
  await findByText('Open', {}, { timeout: 10000 })
  await findByText('Show all regions in assembly')
}, 15000)
