import '@testing-library/jest-dom'

import { fireEvent, render } from '@testing-library/react'

import AssemblySelector from './AssemblySelector.tsx'

import type { AbstractSessionModel } from '../util/index.ts'

function makeSession(
  assemblyNames: string[],
  displayNames?: Record<string, string>,
  resolvable: Record<string, string> = {},
) {
  return {
    assemblyNames,
    assemblyManager: {
      get: (name: string) =>
        displayNames
          ? { displayName: displayNames[name] }
          : resolvable[name]
            ? { displayName: resolvable[name] }
            : undefined,
      getCanonicalAssemblyName: (name: string) =>
        name === 'GRCh38' ? 'hg38' : resolvable[name] ? name : undefined,
    },
  } as unknown as AbstractSessionModel
}

test('an alias shows as the assembly it names', () => {
  const session = makeSession(['hg19', 'hg38'])
  const { getByRole } = render(
    <AssemblySelector
      session={session}
      selected="GRCh38"
      onChange={() => {}}
    />,
  )
  expect(getByRole('combobox')).toHaveTextContent('hg38')
})

// the read panel of a read-vs-ref view: the form submits to an assembly no
// picker offers, and an empty selector read as nothing chosen
test('a resolvable assembly the host does not offer still shows', () => {
  const session = makeSession(['hg38'], undefined, { readvsref: 'Reads' })
  const { getByRole } = render(
    <AssemblySelector
      session={session}
      selected="readvsref"
      onChange={() => {}}
    />,
  )
  expect(getByRole('combobox')).toHaveTextContent('Reads')
})

test('a removed assembly shows no selection', () => {
  const session = makeSession(['hg38'])
  const { getByRole } = render(
    <AssemblySelector session={session} selected="gone" onChange={() => {}} />,
  )
  expect(getByRole('combobox')).not.toHaveTextContent('gone')
})

test('renders assembly names as menu items', async () => {
  const session = makeSession(['hg19', 'hg38'])
  const { getByRole, findByText } = render(
    <AssemblySelector session={session} selected="hg19" onChange={() => {}} />,
  )
  fireEvent.mouseDown(getByRole('combobox'))
  expect(await findByText('hg38')).toBeTruthy()
})

test('calls onChange when user selects an assembly', async () => {
  const session = makeSession(['hg19', 'hg38'])
  const onChange = jest.fn()
  const { getByRole, findAllByText } = render(
    <AssemblySelector session={session} selected="hg19" onChange={onChange} />,
  )
  fireEvent.mouseDown(getByRole('combobox'))
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
  const { getByRole, getByText } = render(
    <AssemblySelector session={session} onChange={() => {}} />,
  )
  expect(getByRole('combobox')).toHaveAttribute('aria-disabled', 'true')
  expect(getByText('No configured assemblies')).toBeInTheDocument()
})
