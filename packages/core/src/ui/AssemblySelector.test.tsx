import '@testing-library/jest-dom'
import { fireEvent, render } from '@testing-library/react'

import AssemblySelector from './AssemblySelector.tsx'

import type { AbstractSessionModel } from '../util/index.ts'

function makeSession(
  assemblyNames: string[],
  displayNames?: Record<string, string>,
) {
  return {
    assemblyNames,
    assemblyManager: {
      getDisplayName: (name: string) => displayNames?.[name] ?? name,
    },
  } as unknown as AbstractSessionModel
}

test('renders assembly names as menu items', async () => {
  const session = makeSession(['hg19', 'hg38'])
  const { getByTestId, findByText } = render(
    <AssemblySelector session={session} selected="hg19" onChange={() => {}} />,
  )
  fireEvent.mouseDown(getByTestId('assembly-selector-select'))
  expect(await findByText('hg38')).toBeTruthy()
})

test('calls onChange when user selects an assembly', async () => {
  const session = makeSession(['hg19', 'hg38'])
  const onChange = jest.fn()
  const { getByTestId, findAllByText } = render(
    <AssemblySelector session={session} selected="hg19" onChange={onChange} />,
  )
  fireEvent.mouseDown(getByTestId('assembly-selector-select'))
  fireEvent.click((await findAllByText('hg38'))[0]!)
  expect(onChange).toHaveBeenCalledWith('hg38')
})

test('shows displayName when available', () => {
  const session = makeSession(['hg19'], { hg19: 'Human (hg19)' })
  const { getByText } = render(
    <AssemblySelector session={session} selected="hg19" onChange={() => {}} />,
  )
  expect(getByText('Human (hg19)')).toBeInTheDocument()
})

test('shows error and disables select when no assemblies configured', () => {
  const session = makeSession([])
  const { getByTestId, getByText } = render(
    <AssemblySelector session={session} onChange={() => {}} />,
  )
  expect(getByTestId('assembly-selector-select')).toHaveAttribute(
    'aria-disabled',
    'true',
  )
  expect(getByText('No configured assemblies')).toBeInTheDocument()
})

test('caller can override select display testid via TextFieldProps slotProps', () => {
  const session = makeSession(['hg19'])
  const { getByTestId, queryByTestId } = render(
    <AssemblySelector
      session={session}
      selected="hg19"
      onChange={() => {}}
      TextFieldProps={{
        slotProps: {
          select: {
            SelectDisplayProps: {
              // @ts-expect-error
              'data-testid': 'my-custom-testid',
            },
          },
        },
      }}
    />,
  )
  expect(getByTestId('my-custom-testid')).toBeTruthy()
  expect(queryByTestId('assembly-selector-select')).toBeNull()
})
