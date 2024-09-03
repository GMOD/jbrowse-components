import '@testing-library/jest-dom'
import { fireEvent, waitFor } from '@testing-library/react'
import { doBeforeEach, createView, setup, mockConsoleWarn } from './util'

setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 40000 }

test(
  'opens a vcf.gz file in the sv inspector view',
  () =>
    mockConsoleWarn(async () => {
      const consoleMock = jest.spyOn(console, 'warn').mockImplementation()
      const { session, findByTestId, getByTestId, findByText } =
        await createView()

      fireEvent.click(await findByText('File'))
      fireEvent.click(await findByText('Add'))
      fireEvent.click(await findByText('SV inspector'))

      fireEvent.change(await findByTestId('urlInput', {}, delay), {
        target: { value: 'volvox.dup.renamed.vcf.gz' },
      })
      await waitFor(() => {
        expect(
          getByTestId('open_spreadsheet').closest('button'),
        ).not.toBeDisabled()
      })
      fireEvent.click(await findByTestId('open_spreadsheet'))
      fireEvent.click(await findByTestId('chord-vcf-0', {}, delay))

      // confirm breakpoint split view opened
      expect(session.views.length).toBe(3)
      expect(session.views[2]!.displayName).toBe('bnd_A split detail')

      consoleMock.mockRestore()
    }),
  60000,
)
