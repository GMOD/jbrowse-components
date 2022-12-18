import React from 'react'
import { render } from '@testing-library/react'
import { toMatchImageSnapshot } from 'jest-image-snapshot'
import path from 'path'

import { App, readBuffer } from './loaderUtil'

// locals
import { setup, doBeforeEach, expectCanvasMatch } from './util'
jest.mock('../makeWorkerInstance', () => () => {})

const delay = { timeout: 25000 }
const opts = [{}, delay]

expect.extend({ toMatchImageSnapshot })
setup()

beforeEach(() => {
  doBeforeEach(url => require.resolve(`../../test_data/${path.basename(url)}`))
})

// @ts-ignore
jest.spyOn(global, 'fetch').mockImplementation(readBuffer)

const r = {
  views: [
    {
      type: 'LinearSyntenyView',
      tracks: ['fileName-1606319049337'],
      views: [
        { loc: 'Pp01:28,845,211..28,845,272[rev]', assembly: 'peach' },
        { loc: 'chr1:316,306..316,364', assembly: 'grape' },
      ],
    },
  ],
}

test('can use a spec url for dotplot view', async () => {
  const { findByTestId } = render(
    <App search='?config=test_data/volvox/config_main_thread.json&session=spec-{"views":[{"type":"DotplotView","views":[{"assembly":"volvox"},{"assembly":"volvox"}],"tracks":["volvox_fake_synteny"]}]}' />,
  )

  await findByTestId('prerendered_canvas_done', {}, delay)
}, 40000)

test('can use a spec url for synteny view', async () => {
  const q = JSON.stringify(r)
  console.log({ q })
  const { findByTestId } = render(
    <App
      search={`?config=test_data/config_synteny_grape_peach.json&session=spec-${q}`}
    />,
  )

  expectCanvasMatch(await findByTestId('synteny_canvas', ...opts))
}, 40000)
