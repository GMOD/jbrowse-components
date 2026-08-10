import { render } from '@testing-library/react'
import { Image, createCanvas } from 'canvas'

import { utilizeFetchMockForTest } from './generateReadBuffer.ts'
import { App } from './loaderUtil.tsx'
import { findDisplayPainted } from './util.tsx'

jest.mock('../makeWorkerInstance', () => () => {})

// @ts-expect-error
global.nodeImage = Image
// @ts-expect-error
global.nodeCreateCanvas = createCanvas

const delay = { timeout: 20000 }

utilizeFetchMockForTest()

test('can use a spec url for dotplot view', async () => {
  render(
    <App search='?config=test_data/volvox/config_main_thread.json&session=spec-{"views":[{"type":"DotplotView","views":[{"assembly":"volvox"},{"assembly":"volvox"}],"tracks":["volvox_fake_synteny"]}]}' />,
  )

  await findDisplayPainted('dotplot_webgl_canvas', delay)
}, 40000)
