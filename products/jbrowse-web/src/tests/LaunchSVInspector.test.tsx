import { render } from '@testing-library/react'

import { App } from './loaderUtil'
import { setupLaunchTest } from './util'

setupLaunchTest()

const delay = { timeout: 20000 }

test('can use a spec url for sv inspector view', async () => {
  console.warn = jest.fn()
  const { findByText } = render(
    <App search='?config=test_data/volvox/config_main_thread.json&session=spec-{"views":[{"type":"SvInspectorView","uri":"test_data/volvox/volvox.dup.vcf.gz","assembly":"volvox"}]}' />,
  )

  await findByText('ctgB:1,982', {}, delay)
}, 40000)
