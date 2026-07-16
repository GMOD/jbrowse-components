import { createTestEnvironment } from './testEnv.ts'

import type { MenuItem } from '@jbrowse/core/ui'

// Structural coverage for the "Subfeature labels" radio group: a three-way radio
// (Off/Below/Overlay) over the promotable `subfeatureLabels` slot, each option
// promotable as the session-wide default. The group is rendered inline in the
// "Show..." submenu under a "Subfeature labels" subHeader. Render-side handling
// of `below` vs `overlay` is covered in labelUtils.test.ts /
// glyphs/subfeatures.test.ts.

function hasLabel(item: MenuItem, label: string) {
  return 'label' in item && item.label === label
}

function subMenuOf(items: MenuItem[], label: string) {
  const item = items.find(i => hasLabel(i, label))
  if (item && 'subMenu' in item) {
    return item.subMenu
  } else {
    throw new Error(`submenu "${label}" not found`)
  }
}

// The radios that follow the "Subfeature labels" subHeader in the flat "Show..."
// submenu, up to the next subHeader/divider.
function showSubMenu(display: { trackMenuItems: () => MenuItem[] }) {
  const items = subMenuOf(display.trackMenuItems(), 'Show...')
  const start = items.findIndex(
    i => i.type === 'subHeader' && i.label === 'Subfeature labels',
  )
  if (start === -1) {
    throw new Error('"Subfeature labels" subHeader not found')
  }
  const rest = items.slice(start + 1)
  const end = rest.findIndex(i => i.type === 'subHeader' || i.type === 'divider')
  return end === -1 ? rest : rest.slice(0, end)
}

function radio(subMenu: MenuItem[], label: string) {
  const item = subMenu.find(i => hasLabel(i, label))
  if (item?.type === 'radio') {
    return item
  } else {
    throw new Error(`radio "${label}" not found`)
  }
}

describe('Subfeature labels submenu', () => {
  it('offers Off/Below/Overlay radios, each carrying a "make default" pin', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    const subMenu = showSubMenu(display)

    const labels = subMenu.flatMap(i => ('label' in i ? [i.label] : []))
    expect(labels).toEqual(['Off', 'Below', 'Overlay'])
    expect(radio(subMenu, 'Off').endAdornment).toBeDefined()
    expect(radio(subMenu, 'Below').endAdornment).toBeDefined()
    expect(radio(subMenu, 'Overlay').endAdornment).toBeDefined()
  })

  it('checks the resolved mode and lets a track pin Below back over a session default', () => {
    const { createDisplay } = createTestEnvironment()
    const { display, session } = createDisplay()

    // a track following the default (subfeatureLabels at the `inherit` sentinel) resolves to
    // the `none` base
    expect(display.subfeatureLabels).toBe('none')
    expect(radio(showSubMenu(display), 'Off').checked).toBe(true)

    // a display-type default flows through the resolved getter without the track
    // customizing its own value
    session.setDisplayTypeDefault(display.type, 'subfeatureLabels', 'overlay')
    expect(display.subfeatureLabels).toBe('overlay')
    expect(radio(showSubMenu(display), 'Overlay').checked).toBe(true)

    // the track can still pin Below back over the Overlay session default
    display.setSubfeatureLabels('below')
    expect(display.subfeatureLabels).toBe('below')
    const subMenu = showSubMenu(display)
    expect(radio(subMenu, 'Below').checked).toBe(true)
    expect(radio(subMenu, 'Overlay').checked).toBe(false)
  })
})
