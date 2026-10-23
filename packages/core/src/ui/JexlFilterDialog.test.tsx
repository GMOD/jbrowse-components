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
  { label: 'maf', call: 'maf', type: 'number', group: 'Computed' },
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

const textBox = () =>
  screen.getByTestId<HTMLTextAreaElement>('jexl-filter-text')

function pickField(label: string) {
  const picker = screen.getByLabelText('Insert field…')
  fireEvent.change(picker, { target: { value: label } })
  fireEvent.click(screen.getByRole('option', { name: new RegExp(label) }))
}

test('shows every line without the prefix and writes it back unchanged', () => {
  const { written, handleClose } = setup()
  expect(screen.getByText('Filter Variants')).toBeInTheDocument()
  expect(textBox().value).toBe(
    STORED.map(line => line.slice('jexl:'.length)).join('\n'),
  )
  apply()
  expect(written).toHaveBeenLastCalledWith(STORED)
  expect(handleClose).toHaveBeenCalled()
})

test('a line that does not compile names its line and blocks Apply', () => {
  const { written } = setup()
  fireEvent.change(textBox(), {
    target: { value: 'feature.QUAL > 5\nfeature.QUAL >' },
  })
  expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled()
  expect(screen.getByText(/^Line 2: .*\(column 15\)$/)).toBeInTheDocument()
  fireEvent.change(textBox(), { target: { value: 'feature.QUAL > 5\n\n' } })
  apply()
  expect(written).toHaveBeenLastCalledWith(['jexl:feature.QUAL > 5'])
})

test('a misspelt function blocks Apply and names the one meant', () => {
  setup()
  fireEvent.change(textBox(), {
    target: { value: "startWith(feature.REF, 'A')" },
  })
  expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled()
  expect(
    screen.getByText(
      /^Line 1: no function startWith; did you mean .*startsWith/,
    ),
  ).toBeInTheDocument()
})

test('a value the field never takes warns without blocking Apply', () => {
  const { written } = setup()
  fireEvent.change(textBox(), {
    target: { value: "feature.QUAL > 5\nfeature.FILTER == 'PAS'" },
  })
  expect(
    screen.getByText(/^Line 2: 'PAS' is not one of the values/),
  ).toBeInTheDocument()
  apply()
  expect(written).toHaveBeenLastCalledWith([
    'jexl:feature.QUAL > 5',
    "jexl:feature.FILTER == 'PAS'",
  ])
})

test('a picked field is written at the cursor', () => {
  setup()
  fireEvent.change(textBox(), { target: { value: ' > 0.01' } })
  textBox().setSelectionRange(0, 0)
  pickField('maf')
  expect(textBox().value).toBe('maf(feature) > 0.01')
})

test('the picker lists known values and replaces a selection', () => {
  setup()
  fireEvent.change(textBox(), { target: { value: "X == 'PASS'" } })
  textBox().setSelectionRange(0, 1)
  pickField('FILTER')
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  expect(textBox().value).toBe("feature.FILTER == 'PASS'")
  fireEvent.change(screen.getByLabelText('Insert field…'), {
    target: { value: 'FILTER' },
  })
  expect(screen.getByText('one of PASS, q10')).toBeInTheDocument()
})

test('waits for fields supplied as a promise', async () => {
  await act(async () => {
    setup(Promise.resolve(FIELDS))
  })
  expect(textBox()).toBeInTheDocument()
})

test('the picker lists the columns the adapter describes', async () => {
  await act(async () => {
    setup(FIELDS, Promise.resolve({ AF: 'Allele Frequency' }))
  })
  fireEvent.change(screen.getByLabelText('Insert field…'), {
    target: { value: 'A' },
  })
  expect(screen.getByText('Allele Frequency')).toBeInTheDocument()
})
