import '@testing-library/jest-dom'

import { fireEvent, render, waitFor } from '@testing-library/react'

import AssemblyManager from './AssemblyManager.tsx'

const assemblies = [
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
]
const mockRootModel = {
  jbrowse: {
    assemblies,
    addAssemblyConf: jest.fn(),
    removeAssemblyConf: jest.fn(),
  },
  session: {
    adminMode: true,
    sessionAssemblies: [],
    assemblies,
    notify: jest.fn(),
    addAssembly: jest.fn(),
    removeAssembly: jest.fn(),
  },
}

test('renders successfully', async () => {
  const { findByText } = render(
    <AssemblyManager
      // @ts-expect-error
      session={mockRootModel.session}
      rootModel={mockRootModel}
      onClose={() => {}}
    />,
  )
  expect(await findByText('Assembly manager')).toBeTruthy()
})

test('opens up the Add Assembly Form when clicked', async () => {
  const { findByText } = render(
    <AssemblyManager
      // @ts-expect-error
      session={mockRootModel.session}
      rootModel={mockRootModel}
      onClose={() => {}}
    />,
  )
  fireEvent.click(await findByText('Add new assembly'))
  expect(await findByText('Submit')).toBeTruthy()
})

test('adds an assembly from a pasted URL (auto-detected)', async () => {
  const { getByText, getByRole, getByTestId } = render(
    <AssemblyManager
      // @ts-expect-error
      session={mockRootModel.session}
      rootModel={mockRootModel}
      onClose={() => {}}
    />,
  )
  fireEvent.click(getByText('Add new assembly'))

  // paste a FASTA url; the pane auto-detects the format and assembly name
  fireEvent.click(getByText('Open from a URL'))
  fireEvent.change(getByRole('textbox'), {
    target: { value: 'https://example.com/ce11.fa' },
  })
  expect(getByTestId('assembly-name')).toHaveValue('ce11')

  fireEvent.click(getByText('Submit'))
  await waitFor(() => {
    expect(mockRootModel.session.addAssembly).toHaveBeenCalledTimes(1)
  })
})

test('Submit is disabled until a sequence is provided', () => {
  const { getByText, getByRole } = render(
    <AssemblyManager
      // @ts-expect-error
      session={mockRootModel.session}
      rootModel={mockRootModel}
      onClose={() => {}}
    />,
  )
  fireEvent.click(getByText('Add new assembly'))
  expect(getByRole('button', { name: 'Submit' })).toBeDisabled()
})

test('deletes an assembly when delete button clicked', () => {
  const { getByTestId } = render(
    <AssemblyManager
      // @ts-expect-error
      session={mockRootModel.session}
      rootModel={mockRootModel}
      onClose={() => {}}
    />,
  )
  fireEvent.click(getByTestId('testAssembly-delete'))
  expect(mockRootModel.session.removeAssembly).toHaveBeenCalledWith(
    'testAssembly',
  )
})

test('closes when the Close button is clicked', () => {
  const onClose = jest.fn()
  const { getByText } = render(
    <AssemblyManager
      // @ts-expect-error
      session={mockRootModel.session}
      rootModel={mockRootModel}
      onClose={onClose}
    />,
  )
  fireEvent.click(getByText('Close'))
  expect(onClose).toHaveBeenCalled()
})
