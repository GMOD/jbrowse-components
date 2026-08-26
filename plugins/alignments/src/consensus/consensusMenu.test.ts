import {
  clickMenuItem,
  createRpcTestEnvironment,
  menuSubItems,
} from '../LinearAlignmentsDisplay/testUtils.ts'
import ConsensusSequenceF from './index.ts'

import type { MenuItem } from '@jbrowse/core/ui'

const LABEL = 'Consensus sequence (visible region)'

test('the alignments track menu offers a consensus, no rubberband needed', () => {
  const { createDisplay } = createRpcTestEnvironment({
    register: ConsensusSequenceF,
  })
  const { display } = createDisplay()
  expect(
    menuSubItems(display.trackMenuItems(), 'Launch view').map(i =>
      'label' in i ? i.label : undefined,
    ),
  ).toContain(LABEL)
})

test('it opens on the region the view is showing, and on its own display', () => {
  const { createDisplay } = createRpcTestEnvironment({
    register: ConsensusSequenceF,
  })
  const { session, view, display } = createDisplay()
  view.zoomTo(10)
  view.scrollTo(2000)

  clickMenuItem(display.trackMenuItems(), LABEL)

  const props = session.queuedDialogs[0]!
  expect(props.display).toBe(display)
  expect(props.regions).toEqual(view.dynamicBlocks.contentBlocks)
  // the window, not the whole displayed region: a consensus over 10Mb of reads
  // where the view is showing 8kb of them is a different answer, and the
  // dialog's size guard would refuse it
  const regions = props.regions as { start: number; end: number }[]
  expect(regions[0]!.end - regions[0]!.start).toBeLessThan(100_000)
})
