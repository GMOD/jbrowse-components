import { render } from '@testing-library/react'

import { App } from './loaderUtil'
import { setupLaunchTest } from './util'

setupLaunchTest()

const delay = { timeout: 20000 }

test('can use a spec url for spreadsheet view', async () => {
  console.warn = jest.fn()
  const { findByText } = render(
    <App search='?config=test_data/volvox/config_main_thread.json&session=spec-{"views":[{"type":"SpreadsheetView","uri":"test_data/volvox/volvox.filtered.vcf.gz","assembly":"volvox"}]}' />,
  )

  await findByText('ctgA:8,471', {}, delay)
}, 40000)
