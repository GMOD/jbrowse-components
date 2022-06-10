import React from 'react'
import { fireEvent, render, waitFor, screen } from '@testing-library/react'
import '@testing-library/jest-dom/extend-expect'
import { createTestSession } from '@jbrowse/web/src/rootModel'
import 'requestidlecallback-polyfill'
import MultilevelLinearView from './MultilevelLinearView'
jest.mock('@jbrowse/web/src/makeWorkerInstance', () => () => {})

const delay = { timeout: 10000 }

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
  it('ranks search results', async () => {
    const session = createTestSession()
    // @ts-ignore
    session.addAssemblyConf(assemblyConf)
    // @ts-ignore
    session.addView('MultilevelLinearView', { id: 'mllv' })
    // @ts-ignore
    const model = session.views[0]
    model.setWidth(800)

    const { findByTestId, findByPlaceholderText, findByText } = render(
      <MultilevelLinearView model={model} />,
    )
    const auto = await findByTestId('autocomplete', {}, { timeout: 10000 })
    const input = await findByPlaceholderText('Search for location')
    auto.focus()
    fireEvent.mouseDown(input)
    fireEvent.change(input, { target: { value: 'ctgB' } })
    fireEvent.keyDown(auto, { key: 'Enter', code: 'Enter' })
    fireEvent.click(await findByText('Open'))

    await waitFor(() => {
      expect(findByText('ctgB:11..10')).toBeDefined()
    })
  })
})
