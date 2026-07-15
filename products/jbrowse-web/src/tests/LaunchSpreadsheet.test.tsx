import { render } from '@testing-library/react'

import { utilizeFetchMockForTest } from './generateReadBuffer.ts'
import { App } from './loaderUtil.tsx'

jest.mock('../makeWorkerInstance', () => () => {})

const delay = { timeout: 20000 }

utilizeFetchMockForTest()

test('can use a spec url for spreadsheet view', async () => {
  jest.spyOn(console, 'warn').mockImplementation()
  const { findByText } = render(
    <App search='?config=test_data/volvox/config_main_thread.json&session=spec-{"views":[{"type":"SpreadsheetView","uri":"test_data/volvox/volvox.filtered.vcf.gz","assembly":"volvox"}]}' />,
  )

  await findByText('ctgA:8,471', {}, delay)
}, 40000)
