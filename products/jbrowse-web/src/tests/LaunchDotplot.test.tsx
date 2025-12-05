import { render } from '@testing-library/react'

import { App } from './loaderUtil'
import { setupLaunchTest } from './util'

setupLaunchTest()

const delay = { timeout: 20000 }

test('can use a spec url for dotplot view', async () => {
  const { findByTestId } = render(
    <App search='?config=test_data/volvox/config_main_thread.json&session=spec-{"views":[{"type":"DotplotView","views":[{"assembly":"volvox"},{"assembly":"volvox"}],"tracks":["volvox_fake_synteny"]}]}' />,
  )

  await findByTestId('prerendered_canvas_done', {}, delay)
}, 40000)
