import { fireEvent, render } from '@testing-library/react'

import EndAdornment from './EndAdornment.tsx'

test('shows only the search icon when there is nothing to put in the menu', () => {
  const { queryByLabelText } = render(<EndAdornment />)
  expect(queryByLabelText('Search box options')).toBeNull()
})

test('overflow menu lists injected items alongside help', async () => {
  const onClick = jest.fn()
  const { getByLabelText, findByText } = render(
    <EndAdornment showHelp menuItems={[{ label: 'chr1:1-100', onClick }]} />,
  )
  fireEvent.click(getByLabelText('Search box options'))
  expect(await findByText('chr1:1-100')).toBeTruthy()
  expect(await findByText('Search box help')).toBeTruthy()
  fireEvent.click(await findByText('chr1:1-100'))
  expect(onClick).toHaveBeenCalled()
})

test('renders the menu for injected items even without help', async () => {
  const { getByLabelText, findByText, queryByText } = render(
    <EndAdornment menuItems={[{ label: 'chr2', onClick: jest.fn() }]} />,
  )
  fireEvent.click(getByLabelText('Search box options'))
  expect(await findByText('chr2')).toBeTruthy()
  expect(queryByText('Search box help')).toBeNull()
})
