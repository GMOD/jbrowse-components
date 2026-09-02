import { createMafTestEnvironment } from './testEnv.ts'

import type { MafHover } from './util.ts'
import type { MenuItem } from '@jbrowse/core/ui'

function labels(items: MenuItem[]) {
  return items.map(i => ('label' in i ? i.label : undefined))
}

function menuAt(hover?: MafHover) {
  const { display, view } = createMafTestEnvironment().createDisplay()
  view.zoomTo(1)
  display.openContextMenu({
    clientX: 0,
    clientY: 0,
    refName: 'ctgA',
    pos: 1234,
    hover,
  })
  return display
}

const insertion: MafHover = {
  kind: 'insertion',
  length: 4,
  sequence: 'ACGT',
  chr: 'chr2',
  pos: 900,
  strand: 1,
  sampleLabel: 'mm10',
}

// The menu offered the sort and its undo and nothing about the column the click
// landed on, which is what the multi-row painting and the variant displays put
// at the top of theirs.
describe('the right-click menu acts on the column it was opened at', () => {
  it('copies the reference location', () => {
    const display = menuAt()
    expect(labels(display.contextMenuItems())).toContain('Copy location')
  })

  it('opens the insertion the click landed on, and only then', () => {
    expect(labels(menuAt().contextMenuItems())).not.toContain(
      'Open insertion details',
    )
    expect(labels(menuAt(insertion).contextMenuItems())).toContain(
      'Open insertion details',
    )
  })

  it('offers nothing while no menu is open', () => {
    const { display } = createMafTestEnvironment().createDisplay()
    expect(display.contextMenuItems()).toEqual([])
  })
})
