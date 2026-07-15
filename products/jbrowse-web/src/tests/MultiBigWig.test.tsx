import { fireEvent } from '@testing-library/react'

import {
  createView,
  doBeforeEach,
  expectCanvasMatch,
  findCanvasIn,
  hts,
  setup,
} from './util.tsx'

setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 60000 }
const opts = [{}, delay]

test('open a multibigwig xyplot track', async () => {
  const { view, findByTestId } = await createView()
  view.setNewView(5, 0)
  fireEvent.click(await findByTestId(hts('volvox_microarray_multi'), ...opts))
  expectCanvasMatch(
    findCanvasIn(await findByTestId('multi-wiggle-display-done', ...opts)),
  )
}, 60000)

test('open a multibigwig multirowxy track', async () => {
  const { view, findByTestId } = await createView()
  view.setNewView(5, 0)
  fireEvent.click(
    await findByTestId(hts('volvox_microarray_multi_multirowxy'), ...opts),
  )
  expectCanvasMatch(
    findCanvasIn(await findByTestId('multi-wiggle-display-done', ...opts)),
  )
}, 60000)

test('open a multibigwig multirowdensity track', async () => {
  const { view, findByTestId } = await createView()
  view.setNewView(5, 0)
  fireEvent.click(
    await findByTestId(hts('volvox_microarray_multi_multirowdensity'), ...opts),
  )
  expectCanvasMatch(
    findCanvasIn(await findByTestId('multi-wiggle-display-done', ...opts)),
  )
}, 60000)

test('open a multibigwig multiline track', async () => {
  const { view, findByTestId } = await createView()
  view.setNewView(5, 0)
  fireEvent.click(await findByTestId(hts('mytrack'), ...opts))
  expectCanvasMatch(
    findCanvasIn(await findByTestId('multi-wiggle-display-done', ...opts)),
  )
}, 60000)

test('open a multibigwig multirowline track', async () => {
  const { view, findByTestId } = await createView()
  view.setNewView(5, 0)
  fireEvent.click(
    await findByTestId(hts('volvox_microarray_multi_multirowline'), ...opts),
  )
  expectCanvasMatch(
    findCanvasIn(await findByTestId('multi-wiggle-display-done', ...opts)),
  )
}, 60000)
