import { partitionLaunchKeys } from './initKeys.ts'

// Stands in for the view's declared property names, which the real callers read
// off the state model (`linearGenomeViewPropKeys`, or `getPropertyMembers` on a
// live node). The point of passing them in rather than listing them here is that
// there is no list to go stale — these are just the ones this test exercises.
const props: ReadonlySet<string> = new Set([
  'colorByCDS',
  'trackLabels',
  'showGridlines',
  'hideHeader',
  'id',
  'type',
  'launch',
])

test('resolution keys go to init, plain view props go to the snapshot', () => {
  expect(
    partitionLaunchKeys(
      {
        assembly: 'volvox',
        loc: 'ctgA:1-100',
        tracks: ['genes'],
        colorByCDS: true,
        trackLabels: 'offset',
      },
      props,
    ),
  ).toEqual({
    init: { assembly: 'volvox', loc: 'ctgA:1-100', tracks: ['genes'] },
    viewProps: { colorByCDS: true, trackLabels: 'offset' },
    unknown: {},
  })
})

// The gap this closed: a declared property nobody had added to a hand-written
// list warned as a typo and was dropped, so `hideHeader` and `showGridlines`
// were menu-settable and unreachable from any spec.
test('any declared property reaches the snapshot, with nothing listing it', () => {
  const { viewProps, unknown } = partitionLaunchKeys(
    { showGridlines: false, hideHeader: true },
    props,
  )
  expect(viewProps).toEqual({ showGridlines: false, hideHeader: true })
  expect(unknown).toEqual({})
})

test('identity keys are not settable even though the model declares them', () => {
  const { viewProps, unknown } = partitionLaunchKeys(
    { id: 'hijacked', type: 'OtherView', launch: { assembly: 'volvox' } },
    props,
  )
  expect(viewProps).toEqual({})
  expect(unknown).toEqual({
    id: 'hijacked',
    type: 'OtherView',
    launch: { assembly: 'volvox' },
  })
})

// `bpPerPx`/`offsetPx` stopped being declared properties when the viewport
// became a stored window, so the model's own property list no longer contains
// them and they would partition as typos. A spec naming them is not a typo:
// preProcessSnapshot converts them, so they have to reach the snapshot.
test('the pre-window viewport keys still reach the snapshot', () => {
  const { viewProps, unknown } = partitionLaunchKeys(
    { bpPerPx: 10, offsetPx: 1000 },
    props,
  )
  expect(viewProps).toEqual({ bpPerPx: 10, offsetPx: 1000 })
  expect(unknown).toEqual({})
})

// the launcher warns on these; afterAttach warns on the ones that reach a frozen
// init blob. Both need the values kept, not just the names, since the blob is
// rebuilt from the buckets
test('a typo lands in neither bucket so the caller can report it', () => {
  const { init, viewProps, unknown } = partitionLaunchKeys(
    {
      assembly: 'volvox',
      tracksList: true,
      colorByCds: true,
    },
    props,
  )
  expect(init).toEqual({ assembly: 'volvox' })
  expect(viewProps).toEqual({})
  expect(unknown).toEqual({ tracksList: true, colorByCds: true })
})
