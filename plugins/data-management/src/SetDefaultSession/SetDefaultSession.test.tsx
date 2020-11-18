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

describe('SetDefaultSession GUI', () => {
  it('renders succesfully', () => {
    const { getByText } = render(
      <SetDefaultSession
        rootModel={mockRootModel}
        open
        onClose={() => {}}
        currentDefault="New session"
      />,
    )
    expect(getByText('Set Default Session')).toBeTruthy()
  })

  it('closes when the return button is clicked', () => {
    const onClose = jest.fn()
    const { getByText } = render(
      <SetDefaultSession
        rootModel={mockRootModel}
        open
        onClose={onClose}
        currentDefault="New session"
      />,
    )
    fireEvent.click(getByText('Return'))
    expect(onClose).toHaveBeenCalled()
  })

  it('shows no sessions if none are saved', () => {
    const { getByText } = render(
      <SetDefaultSession
        rootModel={mockRootModel}
        open
        onClose={() => {}}
        currentDefault="New session"
      />,
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
        rootModel={MockSavedSessions}
        open
        onClose={() => {}}
        currentDefault="New session"
      />,
    )
    expect(getByText('New session')).toBeTruthy()
  })

  it('sets to the default session when checked', () => {
    const MockSavedSessions = {
      ...mockRootModel,
      session: {
        savedSessions: [
          {
            name: `Moo session`,
          },
        ],
      },
    }
    const { getByRole } = render(
      <SetDefaultSession
        rootModel={MockSavedSessions}
        open
        onClose={() => {}}
        currentDefault="New session"
      />,
    )
    fireEvent.click(getByRole('checkbox'))
    expect(
      MockSavedSessions.jbrowse.setDefaultSessionConf,
    ).toHaveBeenCalledWith({
      name: `Moo session`,
    })
  })

  it('unsets to the default session when unchecked', () => {
    const MockSavedSessions = {
      ...mockRootModel,
      session: {
        savedSessions: [
          {
            name: `Moo session`,
          },
        ],
      },
    }
    const { getByRole } = render(
      <SetDefaultSession
        rootModel={MockSavedSessions}
        open
        onClose={() => {}}
        currentDefault="New session"
      />,
    )
    fireEvent.click(getByRole('checkbox'))
    // Fire a second time to uncheck
    fireEvent.click(getByRole('checkbox'))
    expect(
      MockSavedSessions.jbrowse.setDefaultSessionConf,
    ).toHaveBeenCalledWith({
      name: `New session`,
    })
  })
})
