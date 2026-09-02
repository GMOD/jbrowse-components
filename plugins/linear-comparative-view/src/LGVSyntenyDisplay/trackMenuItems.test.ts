import { resolveSubMenu } from '@jbrowse/core/ui/menuItems'
import { takeSnackbarAction } from '@jbrowse/display-test-utils'

import { createDisplay, createSyntenyEnv } from './testEnv.ts'

import type { MenuItem } from '@jbrowse/core/ui'

// Promotable is a schema fact; the pin is a menu fact. This display's slots are
// promotable because it composes the alignments state model, but its menu is
// curated here — so a row that never asks for a pin leaves the slot promotable
// with nowhere to promote from, and nothing else in the build says so. That is
// what these assert: the call site, not the shared builder (which
// alignments/menus/colorBy.test.tsx already covers).
// agent-docs/reference/DISPLAY_TYPE_DEFAULTS.md keeps the list of slots still
// in that state.

function subMenu(items: MenuItem[], label: string): MenuItem[] {
  const found = items.find(i => 'label' in i && i.label === label)
  if (!found || !('subMenu' in found)) {
    throw new Error(`no "${label}" submenu`)
  }
  return resolveSubMenu(found)
}

function colorRows(display: ReturnType<typeof createDisplay>) {
  return subMenu(display.trackMenuItems() as MenuItem[], 'Color by...').filter(
    i => 'type' in i && i.type === 'radio',
  )
}

test('the curated colour schemes are the four synteny ones', () => {
  expect(
    colorRows(createDisplay()).map(i => ('label' in i ? i.label : undefined)),
  ).toEqual(['Normal', 'Strand', 'Mapping quality', 'Query name'])
})

// LGVSyntenyDisplay overrides `colorBy` purely to give it a synteny
// `promotedBase` (strand, not normal), so a promotable slot with no pin was the
// one shape that made that override unreachable from the UI.
test('every colour row carries a session-default pin', () => {
  const rows = colorRows(createDisplay())
  expect(rows.length).toBeGreaterThan(0)
  expect(rows.filter(i => 'pin' in i && i.pin)).toHaveLength(rows.length)
})

// A promoted default is keyed by display type, so this key is LGVSyntenyDisplay's
// alone — no alignments pin can write it, which is exactly why the missing row
// left the slot pinned to its base forever.
test('a colour pin promotes that scheme for this display type', () => {
  const { session, display } = createSyntenyEnv()
  const strand = colorRows(display).find(
    i => 'label' in i && i.label === 'Strand',
  )
  const pin = strand && 'pin' in strand ? strand.pin : undefined
  if (!pin) {
    throw new Error('no pin on the Strand row')
  }
  expect(pin.control.active).toBe(false)
  // the click applies Strand to the open tracks; the toast's one action is what
  // makes it this display type's default (ADR-048)
  pin.control.toggle()
  takeSnackbarAction(session)

  const after = colorRows(display).find(
    i => 'label' in i && i.label === 'Strand',
  )
  expect(after && 'pin' in after ? after.pin?.control.active : undefined).toBe(
    true,
  )
})
