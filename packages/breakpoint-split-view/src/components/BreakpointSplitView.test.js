import React from 'react'
import { render } from '@testing-library/react'
import { createTestSession } from '@gmod/jbrowse-web/src/rootModel'
import sizeMe from 'react-sizeme'
import BreakpointSplitView from './BreakpointSplitView'

sizeMe.noPlaceholders = true

describe('BreakpointSplitView genome view component', () => {
  it('renders with an empty model', () => {
    const session = createTestSession({
      views: [
        {
          type: 'BreakpointSplitView',
          views: [
            {
              type: 'LinearGenomeView',
              offsetPx: 0,
              bpPerPx: 1,
              tracks: [],
            },
            {
              type: 'LinearGenomeView',
              tracks: [],
            },
          ],
          controlsWidth: 100,
          configuration: {},
        },
      ],
    })
    const model = session.views[0]
    const SplitView = new BreakpointSplitView(session.pluginManager)
    const { container } = render(<SplitView model={model} />)
    expect(container.firstChild).toMatchSnapshot()
  })
})
