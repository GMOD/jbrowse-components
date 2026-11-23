import { act, fireEvent, render } from '@testing-library/react'
import { observable, runInAction } from 'mobx'
import { observer } from 'mobx-react'

import ClearableSearchField, { SearchField } from './ClearableSearchField.tsx'

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

// the box over an observable query, as TrackFilterBox draws it over the
// track table's filterText
function renderOverModel(initial: string) {
  const model = observable({ query: initial })
  const setQuery = (query: string) => {
    runInAction(() => {
      model.query = query
    })
  }
  const Box = observer(function Box() {
    return (
      <ClearableSearchField
        label="Filter tracks"
        value={model.query}
        onChange={setQuery}
      />
    )
  })
  const { container } = render(<Box />)
  return {
    model,
    box: () => container.querySelector('input')!,
    setQuery: (query: string) => {
      act(() => {
        setQuery(query)
      })
    },
  }
}

// an agent or window.jb sets the query on the model, not in the box
test('a query set on the model replaces the text in the box', () => {
  const { box, setQuery } = renderOverModel('k562')
  setQuery('k562 bernstein')
  expect(box().value).toBe('k562 bernstein')
  setQuery('')
  expect(box().value).toBe('')
})

test('typing reaches the model and stays in the box', () => {
  const { box, model } = renderOverModel('')
  for (const text of ['l', 'li', 'liv']) {
    act(() => {
      fireEvent.change(box(), { target: { value: text } })
    })
  }
  expect(box().value).toBe('liv')
  expect(model.query).toBe('liv')
})
