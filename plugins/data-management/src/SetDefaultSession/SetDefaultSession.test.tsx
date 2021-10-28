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
  },
  session: {
    savedSessions: [],
    setDefaultSession: jest.fn(),
    rpcManager: {},
    configuration: {},
  },
}

const session = mockRootModel.session

describe('SetDefaultSession GUI', () => {
  it('renders succesfully', () => {
    const { getByText } = render(
      <SetDefaultSession session={session} open onClose={() => {}} />,
    )
    expect(getByText('Set default session')).toBeTruthy()
  })

  it('closes when the return button is clicked', () => {
    const onClose = jest.fn()
    const { getByText } = render(
      <SetDefaultSession session={session} open onClose={onClose} />,
    )
    fireEvent.click(getByText('Cancel'))
    expect(onClose).toHaveBeenCalled()
  })

  it('shows no sessions if none are saved', () => {
    const { getByText } = render(
      <SetDefaultSession session={session} open onClose={() => {}} />,
    )
    expect(getByText('No saved sessions found')).toBeTruthy()
  })

  it('lists the saved sessions', () => {
    const MockSavedSessions = {
      ...mockRootModel,
      session: {
        ...mockRootModel.session,
        savedSessions: [
          {
            name: `New session`,
          },
        ],
      },
    }
    const { getByText } = render(
      <SetDefaultSession
        session={MockSavedSessions.session}
        open
        onClose={() => {}}
      />,
    )
    expect(getByText('New session')).toBeTruthy()
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
      <SetDefaultSession
        session={MockSession.session}
        open
        onClose={() => {}}
      />,
    )
    fireEvent.click(getByText('Clear default session'))
    expect(MockSession.session.setDefaultSession).toHaveBeenCalledWith({
      name: `New session`,
    })
  })
})
