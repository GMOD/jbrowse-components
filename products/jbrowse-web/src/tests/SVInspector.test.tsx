import '@testing-library/jest-dom'
import { fireEvent, waitFor } from '@testing-library/react'

import { mockConsoleWarn, openViewWithFileInput, setupTest } from './util'

setupTest()

const delay = { timeout: 40000 }

test('opens a vcf.gz file in the sv inspector view', () => {
  return mockConsoleWarn(async () => {
    const { session, findByTestId } = await openViewWithFileInput({
      menuPath: ['File', 'Add', 'SV inspector'],
      fileUrl: 'volvox.dup.renamed.vcf.gz',
    })

    fireEvent.click(await findByTestId('chord-vcf-0', {}, delay))

    await waitFor(() => {
      expect(session.views.length).toBe(3)
    })
    expect(session.views[2]!.displayName).toBe('bnd_A split detail')
  })
}, 60000)
