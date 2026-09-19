import '@testing-library/jest-dom'

import { fireEvent, render } from '@testing-library/react'

import ChannelSpecDialog from './ChannelSpecDialog.tsx'

import type { ChannelSpec } from './channelSpec.ts'

function setup({
  problems = [],
  seed,
  current = { facet: { field: 'strand' }, color: null, filter: null },
}: {
  problems?: string[]
  seed?: ChannelSpec
  current?: ChannelSpec
} = {}) {
  const model = {
    channelSpec: current,
    channelSpecExamples: [
      { spec: '{ "facet": "strand" }', description: 'one section per strand' },
    ],
    channelSpecProblems: jest.fn(() => problems),
    colorScaleChoices: ['categorical'],
    applyDisplaySettings: jest.fn(),
    setJexlFilters: jest.fn(),
  }
  const handleClose = jest.fn()
  const utils = render(
    <ChannelSpecDialog model={model} seed={seed} handleClose={handleClose} />,
  )
  const field = utils.getByTestId('channel-spec-json') as HTMLTextAreaElement
  const apply = utils.getByRole('button', { name: 'Apply' })
  const type = (spec: unknown) => {
    fireEvent.change(field, { target: { value: JSON.stringify(spec) } })
  }
  return { ...utils, model, handleClose, field, apply, type }
}

test('opens on the current channels', () => {
  const { field } = setup()
  expect(JSON.parse(field.value)).toEqual({
    facet: { field: 'strand' },
    color: null,
    filter: null,
  })
})

test("lists the display's examples", () => {
  const { getByText } = setup()
  expect(getByText('{ "facet": "strand" }')).toBeInTheDocument()
})

test('a seed from the form it came from is what the box opens on', () => {
  const { field } = setup({ seed: { facet: { field: 'gene_biotype' } } })
  expect(JSON.parse(field.value)).toMatchObject({
    facet: { field: 'gene_biotype' },
  })
})

test('says what a spec changes, and hands the settings to the display and the filter to its setter', () => {
  const { type, getByText, apply, model, handleClose } = setup()
  type({
    facet: null,
    color: { field: 'gene_biotype' },
    filter: ["feature.type == 'gene'"],
  })
  expect(getByText('Sets color, filter. Clears facet')).toBeInTheDocument()
  fireEvent.click(apply)
  expect(model.applyDisplaySettings).toHaveBeenCalledWith({
    facet: null,
    color: { field: 'gene_biotype' },
  })
  expect(model.setJexlFilters).toHaveBeenCalledWith([
    "jexl:feature.type == 'gene'",
  ])
  expect(handleClose).toHaveBeenCalled()
})

test('a spec naming only a filter writes no setting', () => {
  const { type, apply, model } = setup()
  type({ filter: null })
  fireEvent.click(apply)
  expect(model.applyDisplaySettings).not.toHaveBeenCalled()
  expect(model.setJexlFilters).toHaveBeenCalledWith([])
})

test('a facet with no domain over an ordered one says its sections sort', () => {
  const { type, getByText } = setup({
    current: { facet: { field: 'x', domain: ['b', 'a'] } },
  })
  type({ facet: { field: 'x' } })
  expect(
    getByText('Sets facet. The facet names no domain, so its sections sort'),
  ).toBeInTheDocument()
})

test('a spec the parser refuses cannot be applied, and says why under the box', () => {
  const { type, apply, getByText, field } = setup()
  type({ group: 'x' })
  expect(apply).toBeDisabled()
  const message = getByText(/not group/)
  expect(
    field.compareDocumentPosition(message) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy()
})

test('a spec the display refuses cannot be applied', () => {
  const { type, apply, getByText } = setup({
    problems: ['filter: bad expression'],
  })
  type({ filter: 'x >' })
  expect(apply).toBeDisabled()
  expect(getByText(/bad expression/)).toBeInTheDocument()
})
