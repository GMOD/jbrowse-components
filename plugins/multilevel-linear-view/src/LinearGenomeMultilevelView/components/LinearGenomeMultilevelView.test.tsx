import React from 'react'
import { fireEvent, render } from '@testing-library/react'
import '@testing-library/jest-dom/extend-expect'
import { createTestSession } from '@jbrowse/web/src/rootModel'
import 'requestidlecallback-polyfill'
import LinearGenomeMultilevelView from './LinearGenomeMultilevelView'
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
        {
          refName: 'ctgB',
          uniqueId: 'secondId',
          start: 8,
          end: 10,
          seq: 'cattgttgcgatt',
        },
      ],
    },
  },
}

describe('<LinearGenomeMultilevelView />', () => {
  console.warn = jest.fn()
  it('renders the view', async () => {
    const session = createTestSession()
    // @ts-ignore
    session.addAssemblyConf(assemblyConf)
    // @ts-ignore
    session.addView('LinearGenomeMultilevelView', { id: 'lgmlv' })
    // @ts-ignore
    const model = session.views[0]
    model.setWidth(800)
    const { findByText } = render(<LinearGenomeMultilevelView model={model} />)
    fireEvent.click(await findByText('Open'))
    expect(await findByText('No tracks active.')).toBeDefined()
  })
})
