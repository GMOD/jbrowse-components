import { fireEvent, render } from '@testing-library/react'

import { HTTPBasicLoginForm } from './HTTPBasicLoginForm.tsx'

// btoa throws on anything past Latin-1, inside the submit handler, so a
// password with a € in it left the dialog open with nothing shown
test('a credential past Latin-1 is encoded as UTF-8', () => {
  const handleClose = jest.fn()
  const { getByTestId, getByText } = render(
    <HTTPBasicLoginForm internetAccountId="lab" handleClose={handleClose} />,
  )
  fireEvent.change(getByTestId('login-httpbasic-username'), {
    target: { value: 'jürgen' },
  })
  fireEvent.change(getByTestId('login-httpbasic-password'), {
    target: { value: 'pass€' },
  })
  fireEvent.click(getByText('Submit'))

  expect(handleClose).toHaveBeenCalledWith(
    Buffer.from('jürgen:pass€', 'utf8').toString('base64'),
  )
})
