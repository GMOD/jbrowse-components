import { render } from '@testing-library/react'
import { Image, createCanvas } from 'canvas'

import { utilizeFetchMockForTest } from './generateReadBuffer.ts'
import { App } from './loaderUtil.tsx'

jest.mock('../makeWorkerInstance', () => () => {})

// @ts-expect-error
global.nodeImage = Image
// @ts-expect-error
global.nodeCreateCanvas = createCanvas

const delay = { timeout: 20000 }

utilizeFetchMockForTest()

test('can use a spec url for dotplot view', async () => {
  const { findByTestId } = render(
    <App search='?config=test_data/volvox/config_main_thread.json&session=spec-{"views":[{"type":"DotplotView","views":[{"assembly":"volvox"},{"assembly":"volvox"}],"tracks":["volvox_fake_synteny"]}]}' />,
  )

  await findByTestId('dotplot_webgl_canvas_done', {}, delay)
}, 40000)
