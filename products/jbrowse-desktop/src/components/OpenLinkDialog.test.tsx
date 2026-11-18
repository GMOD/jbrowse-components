import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import OpenLinkDialog from './OpenLinkDialog.tsx'

function okButton() {
  return screen.getByRole<HTMLButtonElement>('button', { name: 'OK' })
}

test('OK waits for a link, and a blank one does not count', () => {
  render(<OpenLinkDialog onSubmit={jest.fn()} onClose={jest.fn()} />)
  const field = screen.getByRole('textbox')

  expect(okButton().disabled).toBe(true)
  fireEvent.change(field, { target: { value: '   ' } })
  expect(okButton().disabled).toBe(true)
  fireEvent.change(field, { target: { value: 'https://jbrowse.org/x' } })
  expect(okButton().disabled).toBe(false)
})

test('OK opens the pasted link and closes', async () => {
  const onSubmit = jest.fn(async () => {})
  const onClose = jest.fn()
  render(<OpenLinkDialog onSubmit={onSubmit} onClose={onClose} />)

  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: 'https://jbrowse.org/x' },
  })
  fireEvent.click(okButton())

  await waitFor(() => {
    expect(onClose).toHaveBeenCalled()
  })
  expect(onSubmit).toHaveBeenCalledWith('https://jbrowse.org/x')
})
