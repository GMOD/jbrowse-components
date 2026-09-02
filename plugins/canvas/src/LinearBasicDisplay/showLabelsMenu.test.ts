import { resolveSubMenu } from '@jbrowse/core/ui/menuItems'

import { createTestEnvironment } from './testEnv.ts'

import type { MenuItem } from '@jbrowse/core/ui'

// Structural coverage for the "Labels" radio group: the five rungs of the
// unified `showLabels` enum (which absorbed the retired showDescriptions
// boolean), each promotable as the session-wide default. The group renders
// inline in the "Show..." submenu under a "Labels" subHeader, the same shape as
// "Subfeature labels" next door.
//
// What the enum resolves *into* — which of names and descriptions actually
// paint at this zoom and display mode — is `showLabels` / `showDescriptions` on
// the model, covered by the layout and label tests. This is about the choice.

function hasLabel(item: MenuItem, label: string) {
  return 'label' in item && item.label === label
}

function subMenuOf(items: MenuItem[], label: string) {
  const item = items.find(i => hasLabel(i, label))
  if (item && 'subMenu' in item) {
    return resolveSubMenu(item)
  } else {
    throw new Error(`submenu "${label}" not found`)
  }
}

// The radios that follow the "Labels" subHeader in the flat "Show..." submenu,
// up to the next subHeader/divider.
function showSubMenu(display: { trackMenuItems: () => MenuItem[] }) {
  const items = subMenuOf(display.trackMenuItems(), 'Show...')
  const start = items.findIndex(
    i => i.type === 'subHeader' && i.label === 'Labels',
  )
  if (start === -1) {
    throw new Error('"Labels" subHeader not found')
  }
  const rest = items.slice(start + 1)
  const end = rest.findIndex(
    i => i.type === 'subHeader' || i.type === 'divider',
  )
  return end === -1 ? rest : rest.slice(0, end)
}

// `label` is `ReactNode` across the MenuItem union, so narrow rather than hand a
// `ReactNode` to `radio` below — every row of this group carries a plain string.
function labelsOf(subMenu: MenuItem[]) {
  return subMenu.flatMap(i =>
    'label' in i && typeof i.label === 'string' ? [i.label] : [],
  )
}

function radio(subMenu: MenuItem[], label: string) {
  const item = subMenu.find(i => hasLabel(i, label))
  if (item?.type === 'radio') {
    return item
  } else {
    throw new Error(`radio "${label}" not found`)
  }
}

describe('Labels submenu', () => {
  it('offers every rung, each carrying a "make default" pin', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    const subMenu = showSubMenu(display)

    const labels = labelsOf(subMenu)
    expect(labels).toEqual([
      'Auto',
      'Name + description',
      'Name only',
      'Description only',
      'None',
    ])
    for (const label of labels) {
      expect(radio(subMenu, label).pin).toBeDefined()
    }
  })

  it('checks the resolved rung and follows a session-wide default', () => {
    const { createDisplay } = createTestEnvironment()
    const { display, session } = createDisplay()

    // a track following the default (the slot at its inherit sentinel) resolves
    // to the `auto` base, which is what every existing config renders as today
    expect(display.showLabelsMode).toBe('auto')
    expect(radio(showSubMenu(display), 'Auto').checked).toBe(true)

    session.setDisplayTypeDefault(display.type, 'showLabels', 'none')
    expect(display.showLabelsMode).toBe('none')
    expect(radio(showSubMenu(display), 'None').checked).toBe(true)
    // the two derived flags the rest of the display reads move with it
    expect(display.showLabels).toBe(false)
    expect(display.showDescriptions).toBe(false)
  })

  it('lets a track pin the base rung back over a session default', () => {
    const { createDisplay } = createTestEnvironment()
    const { display, session } = createDisplay()

    session.setDisplayTypeDefault(display.type, 'showLabels', 'none')
    expect(display.showLabelsMode).toBe('none')

    // `auto` is the base, and spending only the unset state on the sentinel is
    // what leaves it customizable over an opposite default — a track that wants
    // density-adaptive labels under a session-wide "None" can say so
    display.setShowLabels('auto')
    expect(display.showLabelsMode).toBe('auto')
    expect(radio(showSubMenu(display), 'Auto').checked).toBe(true)
  })
})
