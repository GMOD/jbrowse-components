import { cleanup, fireEvent, render } from '@testing-library/react'
import { getParent } from 'mobx-state-tree'
import { afterEach, expect, test, vi } from 'vitest'

import AssemblyManager from './AssemblyManager'

import type { AbstractSessionModel } from '@jbrowse/core/util'

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
      notify: vi.fn(),
    },
  }
  // @ts-expect-error
  const s = mockRootModel.session as AbstractSessionModel
  return s
}

test('renders successfully', () => {
  const s = makeRoot()
  const { getByText } = render(
    <AssemblyManager session={s} onClose={() => {}} />,
  )
  expect(getByText('Assembly manager')).toBeTruthy()
})

test('opens up the Add Assembly Form when clicked', () => {
  const s = makeRoot()
  const { getByText } = render(
    <AssemblyManager session={s} onClose={() => {}} />,
  )
  fireEvent.click(getByText('Add new assembly'))
  expect(getByText('Create new assembly')).toBeTruthy()
})

test('calls addAssemblyConf from the Add Assembly form', () => {
  const s = makeRoot()
  const { getByText, getByTestId } = render(
    <AssemblyManager session={s} onClose={() => {}} />,
  )
  fireEvent.click(getByText('Add new assembly'))

  // enter a new assembly and submit
  fireEvent.change(getByTestId('assembly-name'), {
    target: {
      value: 'ce11',
    },
  })
  fireEvent.click(getByText('Create new assembly'))

  expect(getParent<any>(s).jbrowse.addAssemblyConf).toHaveBeenCalledTimes(1)
})

test("prompts the user for a name when adding assembly if they don't", () => {
  const s = makeRoot()
  const { getByText } = render(
    <AssemblyManager session={s} onClose={() => {}} />,
  )
  fireEvent.click(getByText('Add new assembly'))
  fireEvent.click(getByText('Create new assembly'))
  expect(s.notify).toHaveBeenCalledWith(
    "Can't create an assembly without a name",
  )
})

test('deletes an assembly when delete button clicked', () => {
  const s = makeRoot()
  const { getByTestId } = render(
    <AssemblyManager session={s} onClose={() => {}} />,
  )
  fireEvent.click(getByTestId('testAssembly-delete'))
  expect(getParent<any>(s).jbrowse.removeAssemblyConf).toHaveBeenCalledWith(
    'testAssembly',
  )
})

test('closes when the Close button is clicked', () => {
  const s = makeRoot()
  const onClose = vi.fn()
  const { getByText } = render(
    <AssemblyManager session={s} onClose={onClose} />,
  )
  fireEvent.click(getByText('Close'))
  expect(onClose).toHaveBeenCalled()
})
