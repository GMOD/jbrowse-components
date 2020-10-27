import React from 'react'
import { render } from '@testing-library/react'

import AssemblyManager from './AssemblyManager'

const mockRootModel = {
  jbrowse: {
    assemblies: [
      {
        name: 'testAssembly',
        sequence: {
          type: 'testSequenceTrack',
          trackId: '',
          adapter: {
            type: 'testSeqAdapter',
            twoBitLocation: {
              uri: 'test.2bit',
            },
          },
        },
      },
    ],
  },
}

describe('AsssemblyManager GUI', () => {
  it('renders succesfully', () => {
    const { getByText } = render(
      <AssemblyManager rootModel={mockRootModel} open onClose={() => {}} />,
    )
    expect(getByText('Assembly Manager')).toBeTruthy()
  })
})
