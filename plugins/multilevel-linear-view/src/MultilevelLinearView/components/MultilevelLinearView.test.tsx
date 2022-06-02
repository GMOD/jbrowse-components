import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/extend-expect'
import { createTestSession } from '@jbrowse/web/src/rootModel'
import 'requestidlecallback-polyfill'
import MultilevelLinearView from './MultilevelLinearView'
jest.mock('@jbrowse/web/src/makeWorkerInstance', () => () => {})

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

describe('<MultilevelLinearView />', () => {
  it('renders setup wizard', async () => {
    const session = createTestSession()
    // @ts-ignore
    session.addAssemblyConf(assemblyConf)
    // @ts-ignore
    session.addView('MultilevelLinearView', { id: 'mllv' })
    // @ts-ignore
    const model = session.views[0]
    model.setWidth(800)
    const { findByText } = render(<MultilevelLinearView model={model} />)
    fireEvent.click(await findByText('Open'))
    await waitFor(() => {
      expect(model.views.length).toBe(2)
    })
  })
})
