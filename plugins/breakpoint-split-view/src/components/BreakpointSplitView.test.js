import React, { Suspense } from 'react'
import { render } from '@testing-library/react'
import { createTestSession } from '@jbrowse/web/src/rootModel'
import sizeMe from 'react-sizeme'
import BreakpointSplitView from './BreakpointSplitView'

sizeMe.noPlaceholders = true

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
          id: 'lgv1',
          offsetPx: 0,
          bpPerPx: 1,
          tracks: [],
          displayedRegions: [
            { assemblyName: 'volMyt1', refName: 'ctgA', start: 0, end: 5 },
          ],
        },
        {
          type: 'LinearGenomeView',
          id: 'lgv2',
          tracks: [],
          displayedRegions: [
            { assemblyName: 'volMyt1', refName: 'ctgA', start: 5, end: 10 },
          ],
        },
      ],
      configuration: {},
    })
    const model = session.views[0]
    model.setWidth(800)
    const { findAllByText } = render(
      <Suspense fallback={<div />}>
        <BreakpointSplitView model={model} />
      </Suspense>,
    )
    await findAllByText('No tracks active.')
  })
})
