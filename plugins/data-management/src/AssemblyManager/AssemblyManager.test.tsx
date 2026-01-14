import { fireEvent, render } from '@testing-library/react'

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

test('renders successfully', () => {
  const { getByText } = render(
    <AssemblyManager
      // @ts-expect-error
      session={mockRootModel.session}
      rootModel={mockRootModel}
      onClose={() => {}}
    />,
  )
  expect(getByText('Assembly manager')).toBeTruthy()
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

test('calls addAssemblyConf from the Add Assembly form', () => {
  const { getByText, getByTestId } = render(
    <AssemblyManager
      // @ts-expect-error
      session={mockRootModel.session}
      rootModel={mockRootModel}
      onClose={() => {}}
    />,
  )
  fireEvent.click(getByText('Add new assembly'))

  // enter a new assembly and submtest
  fireEvent.change(getByTestId('assembly-name'), {
    target: {
      value: 'ce11',
    },
  })
  fireEvent.click(getByText('Submit'))

  expect(mockRootModel.session.addAssembly).toHaveBeenCalledTimes(1)
})

test("prompts the user for a name when adding assembly if they don't", () => {
  const { getByText } = render(
    <AssemblyManager
      // @ts-expect-error
      session={mockRootModel.session}
      rootModel={mockRootModel}
      onClose={() => {}}
    />,
  )
  fireEvent.click(getByText('Add new assembly'))
  fireEvent.click(getByText('Submit'))
  expect(mockRootModel.session.notify).toHaveBeenCalledWith(
    "Can't create an assembly without a name",
  )
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
