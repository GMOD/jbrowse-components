import '@testing-library/jest-dom'

import { Suspense } from 'react'

import { cast, types } from '@jbrowse/mobx-state-tree'
import { act, fireEvent, render, screen } from '@testing-library/react'

import { ConfigurationSchema } from '../configuration/index.ts'
import createJexlInstance from '../util/jexl.ts'
import JexlFilterDialog from './JexlFilterDialog.tsx'

import type { JexlFilterField } from './JexlFilterDialog.tsx'

const STORED = [
  "jexl:feature.QUAL>=25&&feature.FILTER=='PASS'",
  'jexl:feature.INFO.AC / feature.INFO.AN > 0.1',
]

const FIELDS: JexlFilterField[] = [
  { label: 'QUAL', path: ['QUAL'], type: 'number', group: 'Columns' },
  {
    label: 'FILTER',
    path: ['FILTER'],
    type: 'text',
    group: 'Columns',
    values: ['PASS', 'q10'],
  },
]

function setup(
  fields: JexlFilterField[] | Promise<JexlFilterField[]> = FIELDS,
  metadata?: Promise<unknown>,
) {
  const written = jest.fn<undefined, [string[] | undefined]>()
  const track = types
    .model('Track', {
      configuration: ConfigurationSchema(
        'TestTrack',
        { name: { type: 'string', defaultValue: '' } },
        { explicitIdentifier: 'trackId' },
      ),
      display: types
        .model('Display', {
          filter: types.optional(types.array(types.string), STORED),
        })
        .views(self => ({
          configuredFilters: () => [...self.filter],
          baseFilters: () => STORED,
        }))
        .actions(self => ({
          setFilter(filters?: string[]) {
            written(filters)
            self.filter = cast(filters ?? STORED)
          },
        })),
    })
    .create(
      { configuration: { trackId: 't1', name: 'Variants' }, display: {} },
      { pluginManager: { jexl: createJexlInstance() } },
    )
  const handleClose = jest.fn()
  render(
    <Suspense fallback={null}>
      <JexlFilterDialog
        model={track.display}
        handleClose={handleClose}
        fields={fields}
        metadata={metadata}
      />
    </Suspense>,
  )
  return { written, handleClose }
}

const apply = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
}

test('shows a line as rows and writes an untouched one back unchanged', () => {
  const { written, handleClose } = setup()
  expect(screen.getByText('Filter Variants')).toBeInTheDocument()
  expect(screen.getByDisplayValue('QUAL')).toBeInTheDocument()
  expect(screen.getByDisplayValue('25')).toBeInTheDocument()
  expect(screen.getByDisplayValue('FILTER')).toBeInTheDocument()
  expect(screen.getByDisplayValue('PASS')).toBeInTheDocument()
  expect(
    screen.getByDisplayValue('feature.INFO.AC / feature.INFO.AN > 0.1'),
  ).toBeInTheDocument()
  apply()
  expect(written).toHaveBeenLastCalledWith(STORED)
  expect(handleClose).toHaveBeenCalled()
})

test('visiting a field without changing it leaves its line alone', () => {
  const { written } = setup()
  const field = screen.getByDisplayValue('QUAL')
  fireEvent.focus(field)
  fireEvent.blur(field)
  const value = screen.getByDisplayValue('PASS')
  fireEvent.focus(value)
  fireEvent.blur(value)
  apply()
  expect(written).toHaveBeenLastCalledWith(STORED)
})

test('editing a condition writes each condition of its line alone', () => {
  const { written } = setup()
  fireEvent.change(screen.getByDisplayValue('25'), { target: { value: '30' } })
  apply()
  expect(written).toHaveBeenLastCalledWith([
    'jexl:feature.QUAL >= 30',
    "jexl:feature.FILTER == 'PASS'",
    STORED[1],
  ])
})

test('the Text tab edits every line as text, without the prefix', () => {
  const { written } = setup()
  fireEvent.click(screen.getByRole('tab', { name: 'Text' }))
  const box = screen.getByDisplayValue(/feature\.QUAL>=25/)
  expect((box as HTMLTextAreaElement).value).toBe(
    STORED.map(line => line.slice('jexl:'.length)).join('\n'),
  )
  fireEvent.change(box, { target: { value: 'feature.QUAL >' } })
  expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled()
  expect(screen.getByText(/^Line 1:/)).toBeInTheDocument()
  fireEvent.change(box, { target: { value: 'feature.QUAL > 5\n\n' } })
  apply()
  expect(written).toHaveBeenLastCalledWith(['jexl:feature.QUAL > 5'])
})

test('waits for fields supplied as a promise', async () => {
  await act(async () => {
    setup(Promise.resolve(FIELDS))
  })
  expect(screen.getByDisplayValue('QUAL')).toBeInTheDocument()
})

test('a typed field takes a numeric operator and writes a number', () => {
  const { written } = setup()
  fireEvent.click(screen.getByRole('button', { name: 'Add condition' }))
  const field = screen.getAllByPlaceholderText('Field').at(-1)!
  fireEvent.change(field, { target: { value: 'AF' } })
  fireEvent.blur(field)
  fireEvent.mouseDown(screen.getAllByText('is').at(-1)!)
  expect(screen.getAllByRole('option').map(o => o.textContent)).toEqual([
    'is',
    'is not',
    '>',
    '≥',
    '<',
    '≤',
    'is one of',
    'matches',
  ])
  fireEvent.click(screen.getByRole('option', { name: '≥' }))
  fireEvent.change(screen.getAllByPlaceholderText('Value').at(-1)!, {
    target: { value: '0.001' },
  })
  apply()
  expect(written).toHaveBeenLastCalledWith([
    ...STORED,
    'jexl:feature.AF >= 0.001',
  ])
})

test('the picker lists the columns the adapter describes', async () => {
  await act(async () => {
    setup(FIELDS, Promise.resolve({ AF: 'Allele Frequency' }))
  })
  fireEvent.click(screen.getByRole('button', { name: 'Add condition' }))
  fireEvent.change(screen.getAllByPlaceholderText('Field').at(-1)!, {
    target: { value: 'A' },
  })
  expect(screen.getByText('Allele Frequency')).toBeInTheDocument()
})
