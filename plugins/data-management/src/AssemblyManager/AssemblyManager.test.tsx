import React from 'react'
import { fireEvent, render } from '@testing-library/react'
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
    addAssemblyConf: jest.fn(),
    removeAssemblyConf: jest.fn(),
  },
  session: {
    notify: jest.fn(),
  },
}

describe('AssemblyManager GUI', () => {
  it('renders succesfully', () => {
    const { getByText } = render(
      <AssemblyManager rootModel={mockRootModel} open onClose={() => {}} />,
    )
    expect(getByText('Assembly manager')).toBeTruthy()
  })

  it('opens up the Add Assembly Form when clicked', () => {
    const { getByText } = render(
      <AssemblyManager rootModel={mockRootModel} open onClose={() => {}} />,
    )
    fireEvent.click(getByText('Add new assembly'))
    expect(getByText('Create new assembly')).toBeTruthy()
  })

  it('calls addAssemblyConf from the Add Assembly form', () => {
    const { getByText, getByTestId } = render(
      <AssemblyManager rootModel={mockRootModel} open onClose={() => {}} />,
    )
    fireEvent.click(getByText('Add new assembly'))

    // enter a new assembly and submit
    fireEvent.change(getByTestId('assembly-name'), {
      target: {
        value: 'ce11',
      },
    })
    fireEvent.click(getByText('Create new assembly'))

    expect(mockRootModel.jbrowse.addAssemblyConf).toHaveBeenCalledTimes(1)
  })

  it("prompts the user for a name when adding assembly if they don't", () => {
    const { getByText } = render(
      <AssemblyManager rootModel={mockRootModel} open onClose={() => {}} />,
    )
    fireEvent.click(getByText('Add new assembly'))
    fireEvent.click(getByText('Create new assembly'))
    expect(mockRootModel.session.notify).toHaveBeenCalledWith(
      "Can't create an assembly without a name",
    )
  })

  it('deletes an assembly when delete button clicked', () => {
    const { getByTestId } = render(
      <AssemblyManager rootModel={mockRootModel} open onClose={() => {}} />,
    )
    fireEvent.click(getByTestId('testAssembly-delete'))
    expect(mockRootModel.jbrowse.removeAssemblyConf).toHaveBeenCalledWith(
      'testAssembly',
    )
  })

  it('closes when the Close button is clicked', () => {
    const onClose = jest.fn()
    const { getByText } = render(
      <AssemblyManager rootModel={mockRootModel} open onClose={onClose} />,
    )
    fireEvent.click(getByText('Close'))
    expect(onClose).toHaveBeenCalled()
  })
})
