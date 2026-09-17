import '@testing-library/jest-dom'

import { fireEvent, render } from '@testing-library/react'

import ChannelSpecDialog from './ChannelSpecDialog.tsx'

import type { ChannelSpec } from './channelSpec.ts'

function setup(problems: string[] = []) {
  const current: ChannelSpec = {
    facet: { field: 'strand' },
    color: null,
    filter: null,
  }
  const model = {
    channelSpec: current,
    channelSpecProblems: jest.fn(() => problems),
    applyChannelSpec: jest.fn(),
  }
  const handleClose = jest.fn()
  const utils = render(
    <ChannelSpecDialog model={model} handleClose={handleClose} />,
  )
  const field = utils.getByRole('textbox') as HTMLTextAreaElement
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

test('says what a spec changes, and applies the spec as parsed', () => {
  const { type, getByText, apply, model, handleClose } = setup()
  type({ facet: null, color: 'gene_biotype' })
  expect(getByText('Sets color')).toBeInTheDocument()
  expect(getByText('Clears facet')).toBeInTheDocument()
  fireEvent.click(apply)
  expect(model.applyChannelSpec).toHaveBeenCalledWith({
    facet: null,
    color: { field: 'gene_biotype' },
  })
  expect(handleClose).toHaveBeenCalled()
})

test('a spec the parser refuses cannot be applied', () => {
  const { type, apply, getByText } = setup()
  type({ group: 'x' })
  expect(apply).toBeDisabled()
  expect(getByText(/not group/)).toBeInTheDocument()
})

test('a spec the display refuses cannot be applied', () => {
  const { type, apply, getByText } = setup(['filter: bad expression'])
  type({ filter: 'x >' })
  expect(apply).toBeDisabled()
  expect(getByText(/bad expression/)).toBeInTheDocument()
})
