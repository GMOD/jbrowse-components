import '@testing-library/jest-dom'
import { waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { mockConsoleWarn, openViewWithFileInput, setupTest } from './util'

setupTest()

const delay = { timeout: 40000 }

test('opens a vcf.gz file in the sv inspector view', () => {
  return mockConsoleWarn(async () => {
    const user = userEvent.setup()
    const { session, findByTestId } = await openViewWithFileInput({
      menuPath: ['File', 'Add', 'SV inspector'],
      fileUrl: 'volvox.dup.renamed.vcf.gz',
    })

    await user.click(await findByTestId('chord-vcf-0', {}, delay))

    await waitFor(() => {
      expect(session.views.length).toBe(3)
    })
    expect(session.views[2]!.displayName).toBe('bnd_A split detail')
  })
}, 60000)
