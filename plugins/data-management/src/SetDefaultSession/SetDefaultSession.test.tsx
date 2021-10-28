import React from 'react'
import { fireEvent, render } from '@testing-library/react'
import SetDefaultSession from './SetDefaultSession'

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
              locationType: 'UriLocation',
            },
          },
        },
      },
    ],
    setDefaultSessionConf: jest.fn(),
  },
  session: {
    savedSessions: [],
    notify: jest.fn(),
  },
}

describe('SetDefaultSession GUI', () => {
  it('closes when the return button is clicked', () => {
    const onClose = jest.fn()
    const { getByText } = render(
      <SetDefaultSession rootModel={mockRootModel} onClose={onClose} />,
    )
    fireEvent.click(getByText('Cancel'))
    expect(onClose).toHaveBeenCalled()
  })

  it('unsets to the default session with reset button', () => {
    const MockSession = {
      ...mockRootModel,
      session: {
        ...mockRootModel.session,
        name: `Moo session`,
        savedSessions: [],
        notify: jest.fn(),
      },
    }
    const { getByText } = render(
      <SetDefaultSession rootModel={MockSession} onClose={() => {}} />,
    )
    fireEvent.click(getByText('Clear default session'))
    expect(MockSession.jbrowse.setDefaultSessionConf).toHaveBeenCalledWith({
      name: `New session`,
    })
  })
})
