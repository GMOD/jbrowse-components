import { fireEvent, render } from '@testing-library/react'

import { SearchField } from './ClearableSearchField.tsx'

const clear = { name: 'Clear filter tracks' }

function renderField(value: string, status?: string) {
  const onChange = jest.fn()
  return {
    onChange,
    ...render(
      <SearchField
        label="Filter tracks"
        value={value}
        status={status}
        onChange={onChange}
      />,
    ),
  }
}

test('an empty box shows no clear button, and keeps its room', () => {
  const { queryByRole, getByLabelText } = renderField('')
  expect(queryByRole('button', clear)).toBeNull()
  expect(getByLabelText(clear.name).style.visibility).toBe('hidden')
})

test('an empty box narrowed some other way shows its status alone', () => {
  const { getByRole, queryByRole } = renderField('', '6 of 800')
  expect(getByRole('status').textContent).toBe('6 of 800')
  expect(queryByRole('button', clear)).toBeNull()
})

test('a box with text shows a clear button that empties it', () => {
  const { onChange, getByRole } = renderField('gencode')
  fireEvent.click(getByRole('button', clear))
  expect(onChange).toHaveBeenCalledWith('')
})
