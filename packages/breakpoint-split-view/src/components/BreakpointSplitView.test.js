import React from 'react'
import { render } from '@testing-library/react'
import { createTestSession } from '@gmod/jbrowse-web/src/rootModel'
import sizeMe from 'react-sizeme'
import BreakpointSplitView from './BreakpointSplitView'

sizeMe.noPlaceholders = true

const assemblyConf = {
  name: 'volMyt1',
  sequence: {
    trackId: 'sequenceConfigId',
    adapter: {
      type: 'FromConfigAdapter',
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

// mock warnings to avoid unnecessary outputs
beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  console.warn.mockRestore()
})
describe('BreakpointSplitView genome view component', () => {
  it('renders with an empty model', async () => {
    const session = createTestSession()
    session.addAssemblyConf(assemblyConf)
    session.addView('BreakpointSplitView', {
      views: [
        {
          type: 'LinearGenomeView',
          offsetPx: 0,
          bpPerPx: 1,
          tracks: [],
          displayedRegions: [
            { assemblyName: 'volMyt1', refName: 'ctgA', start: 0, end: 5 },
          ],
        },
        {
          type: 'LinearGenomeView',
          tracks: [],
          displayedRegions: [
            { assemblyName: 'volMyt1', refName: 'ctgA', start: 5, end: 10 },
          ],
        },
      ],
      controlsWidth: 100,
      configuration: {},
    })
    const model = session.views[0]
    const SplitView = new BreakpointSplitView(session.pluginManager)
    const { container, findAllByText } = render(<SplitView model={model} />)
    await findAllByText(
      'No tracks active, click the "select tracks" button to choose some.',
    )
    expect(container.firstChild).toMatchSnapshot()
  })
})
