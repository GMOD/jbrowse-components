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
    savedSessions: {},
  },
}

const session = mockRootModel.session

describe('SetDefaultSession GUI', () => {
  it('renders succesfully', () => {
    const { getByText } = render(
      <SetDefaultSession session={session} open onClose={() => {}} />,
    )
    expect(getByText('Set Default Session')).toBeTruthy()
  })

  it('closes when the return button is clicked', () => {
    const onClose = jest.fn()
    const { getByText } = render(
      <SetDefaultSession session={session} open onClose={onClose} />,
    )
    fireEvent.click(getByText('Return'))
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

  it('sets to the default session when checked', () => {
    const MockSession = {
      ...mockRootModel,
      session: {
        name: `Moo session`,
        savedSessions: [],
        notify: jest.fn(),
      },
    }
    const { getByRole } = render(
      <SetDefaultSession
        session={MockSession.session}
        open
        onClose={() => {}}
      />,
    )
    fireEvent.click(getByRole('radio'))
    expect(MockSession.jbrowse.setDefaultSessionConf).toHaveBeenCalled()
  })

  it('unsets to the default session with reset button', () => {
    const MockSession = {
      ...mockRootModel,
      session: {
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
    expect(MockSession.jbrowse.setDefaultSessionConf).toHaveBeenCalledWith({
      name: `New session`,
    })
  })
})
