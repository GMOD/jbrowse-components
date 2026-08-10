import { fireEvent } from '@testing-library/react'

import {
  createView,
  doBeforeEach,
  expectCanvasMatch,
  findCanvasIn,
  findDisplayPainted,
  hts,
  setup,
  volvoxConfigWithTracks,
} from './util.tsx'

// `view.tracks[0].displays[0]` is untyped; annotating it makes a getter that
// doesn't exist on the model a typecheck error rather than a silent undefined.
import type { MultiWiggleDisplayModel } from '@jbrowse/plugin-wiggle'

setup()

// only the tracks this suite opens, so createView doesn't mount a selector row
// for the other ~120 - see volvoxConfigWithTracks
const config = volvoxConfigWithTracks([
  'volvox_microarray_multi',
  'volvox_microarray_multi_multirowxy',
  'volvox_microarray_multi_multirowdensity',
  'volvox_microarray_multi_multirowline',
  'mytrack',
])

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 60000 }
const opts = [{}, delay]

test('open a multibigwig xyplot track', async () => {
  const { view, findByTestId } = await createView(config)
  view.setNewView(5, 0)
  fireEvent.click(await findByTestId(hts('volvox_microarray_multi'), ...opts))
  expectCanvasMatch(
    findCanvasIn(await findDisplayPainted('multi-wiggle-display', delay)),
  )
}, 60000)

test('open a multibigwig multirowxy track', async () => {
  const { view, findByTestId } = await createView(config)
  view.setNewView(5, 0)
  fireEvent.click(
    await findByTestId(hts('volvox_microarray_multi_multirowxy'), ...opts),
  )
  expectCanvasMatch(
    findCanvasIn(await findDisplayPainted('multi-wiggle-display', delay)),
  )
}, 60000)

test('open a multibigwig multirowdensity track', async () => {
  const { view, findByTestId } = await createView(config)
  view.setNewView(5, 0)
  fireEvent.click(
    await findByTestId(hts('volvox_microarray_multi_multirowdensity'), ...opts),
  )
  expectCanvasMatch(
    findCanvasIn(await findDisplayPainted('multi-wiggle-display', delay)),
  )
}, 60000)

test('open a multibigwig multiline track', async () => {
  const { view, findByTestId } = await createView(config)
  view.setNewView(5, 0)
  fireEvent.click(await findByTestId(hts('mytrack'), ...opts))
  expectCanvasMatch(
    findCanvasIn(await findDisplayPainted('multi-wiggle-display', delay)),
  )
}, 60000)

test('open a multibigwig multirowline track', async () => {
  const { view, findByTestId } = await createView(config)
  view.setNewView(5, 0)
  fireEvent.click(
    await findByTestId(hts('volvox_microarray_multi_multirowline'), ...opts),
  )
  expectCanvasMatch(
    findCanvasIn(await findDisplayPainted('multi-wiggle-display', delay)),
  )
}, 60000)

// The row-order sort itself is unit-tested (sortSourcesByScoreAt, contextMenu);
// what only the real display can answer is whether the right-click reaches it —
// the handler rides `DisplayChrome`'s prop spread onto the same container the
// pointer measurement uses, and nothing else in the wiggle family binds one.
test('right-click offers the row-order sort, and the reset once it has run', async () => {
  const { view, findByTestId, findByText } = await createView(config)
  view.setNewView(5, 0)
  fireEvent.click(
    await findByTestId(hts('volvox_microarray_multi_multirowxy'), ...opts),
  )
  const container = await findDisplayPainted('multi-wiggle-display', delay)
  const display: MultiWiggleDisplayModel = view.tracks[0].displays[0]
  const before = display.sources.map(s => s.name)

  // jsdom reports a zero rect, so clientX lands as the track-local offset
  fireEvent.contextMenu(container, { clientX: 400, clientY: 50 })
  fireEvent.click(await findByText('Sort rows by score here', ...opts))

  // the resulting order is whatever the scores at that column say — what this
  // asserts is that a real one was written, over the same rows
  expect(display.sources.map(s => s.name).toSorted()).toEqual(before.toSorted())

  // "Reset row order" is gated on a written `layout`, so its appearing is the
  // proof the sort landed
  fireEvent.contextMenu(container, { clientX: 400, clientY: 50 })
  fireEvent.click(await findByText('Reset row order', ...opts))

  expect(display.sources.map(s => s.name)).toEqual(before)
}, 60000)
