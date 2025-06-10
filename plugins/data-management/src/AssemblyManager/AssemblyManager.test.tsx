import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'

import AssemblyManager from './AssemblyManager'

afterEach(() => {
  cleanup()
})

function makeRoot() {
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
      addAssemblyConf: vi.fn(),
      removeAssemblyConf: vi.fn(),
    },
    session: {
      adminMode: true,
      notify: vi.fn(),
      addAssembly: vi.fn(),
      sessionAssemblies: [],
      removeAssembly: vi.fn(),
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
  }
  return mockRootModel
}

test('renders successfully', () => {
  const root = makeRoot()
  const { getByText } = render(
    // @ts-expect-error
    <AssemblyManager session={root.session} onClose={() => {}} />,
  )
  expect(getByText('Assembly manager')).toBeTruthy()
})

test('opens up the Add Assembly Form when clicked', () => {
  const root = makeRoot()
  const { getByText } = render(
    // @ts-expect-error
    <AssemblyManager session={root.session} onClose={() => {}} />,
  )
  fireEvent.click(getByText('Add new assembly'))
  expect(getByText('Submit')).toBeTruthy()
})

test('calls addAssemblyConf from the Add Assembly form', () => {
  const root = makeRoot()
  const { getByText, getByTestId } = render(
    // @ts-expect-error
    <AssemblyManager session={root.session} onClose={() => {}} />,
  )
  fireEvent.click(getByText('Add new assembly'))

  // enter a new assembly and submit
  fireEvent.change(getByTestId('assembly-name'), {
    target: {
      value: 'ce11',
    },
  })
  fireEvent.click(getByText('Submit'))
  expect(root.session.addAssembly).toHaveBeenCalledTimes(1)
})

test("prompts the user for a name when adding assembly if they don't", () => {
  const root = makeRoot()
  const { getByText } = render(
    // @ts-expect-error
    <AssemblyManager session={root.session} onClose={() => {}} />,
  )
  fireEvent.click(getByText('Add new assembly'))
  fireEvent.click(getByText('Submit'))
  expect(root.session.notify).toHaveBeenCalledWith(
    "Can't create an assembly without a name",
  )
})

test('deletes an assembly when delete button clicked', () => {
  const root = makeRoot()
  const { getByTestId } = render(
    // @ts-expect-error
    <AssemblyManager session={root.session} onClose={() => {}} />,
  )
  fireEvent.click(getByTestId('testAssembly-delete'))
  expect(root.session.removeAssembly).toHaveBeenCalledWith('testAssembly')
})

test('closes when the Close button is clicked', () => {
  const root = makeRoot()
  const onClose = vi.fn()
  const { getByText } = render(
    // @ts-expect-error
    <AssemblyManager session={root.session} onClose={onClose} />,
  )
  fireEvent.click(getByText('Close'))
  expect(onClose).toHaveBeenCalled()
})
