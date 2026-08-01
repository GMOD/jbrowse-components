import { staysOpenOnClick } from '@jbrowse/core/ui'

import { createTestEnvironment } from './testEnv.ts'

import type { MenuItem } from '@jbrowse/core/ui'

// The shape of the canvas track menu, as opposed to what its items do. Three
// things regressed silently before this existed: a radio group that dismissed
// the whole menu, a filter submenu wrapping one row, and a "Clear all filters"
// offered while nothing was filtered.

function labelOf(item: MenuItem) {
  return 'label' in item ? item.label : undefined
}

function find(items: MenuItem[], label: string) {
  const item = items.find(i => labelOf(i) === label)
  if (item) {
    return item
  } else {
    throw new Error(
      `"${label}" not found in [${items.map(labelOf).join(', ')}]`,
    )
  }
}

function subMenuOf(items: MenuItem[], label: string) {
  const item = find(items, label)
  if ('subMenu' in item) {
    return item.subMenu
  } else {
    throw new Error(`"${label}" has no submenu`)
  }
}

describe('canvas track menu shape', () => {
  it('keeps the menu open for every radio and checkbox that only writes a setting', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    const items: MenuItem[] = display.trackMenuItems()

    // Gene glyph used to be built by a hand-rolled radio helper that omitted
    // keepMenuOpen, so picking a mode dismissed the track menu while its
    // sibling groups (Feature labels, Feature height, ...) stayed put.
    for (const group of [
      subMenuOf(items, 'Gene glyph'),
      subMenuOf(items, 'Show...'),
      subMenuOf(items, 'Set feature height'),
    ]) {
      for (const item of group) {
        if (item.type === 'radio' || item.type === 'checkbox') {
          expect([labelOf(item), staysOpenOnClick(item)]).toEqual([
            labelOf(item),
            true,
          ])
        }
      }
    }
  })

  // "Color by..." can't join the loop above: two of its three radios open a
  // dialog, and those must dismiss. Asserted row by row instead.
  it('keeps the menu open for the color radio that writes a setting, not the dialog openers', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    const colorBy = subMenuOf(display.trackMenuItems(), 'Color by...')

    expect(
      colorBy.map(i => [
        labelOf(i),
        'onClick' in i ? staysOpenOnClick(i) : undefined,
      ]),
    ).toEqual([
      ['Solid color...', false],
      ['Strand', true],
      ['Attribute...', false],
    ])
  })

  // CascadingMenu sorts every level by priority, so this is the order the user
  // sees — not the order the builders happen to append in.
  it('sinks the recovery items below the settings a subclass appends', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setFeatureHighlights([{ refName: 'ctgA', name: 'gene1' }])

    const items: MenuItem[] = display.trackMenuItems()
    const rendered = items
      .toSorted((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
      .map(labelOf)

    // "Gene glyph" is appended by LinearBasicDisplay after the base's filter
    // family, so without the priority it read: ..., Filter by..., Gene glyph
    expect(rendered).toEqual([
      'Show...',
      'Set feature height',
      'Color by...',
      'Gene glyph',
      'Clear 1 highlight',
      'Filter by...',
    ])
  })

  it('offers Filter by... at the top level until a recovery item joins it', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()

    // nothing narrowing the view: one row, no submenu to hover into
    const items: MenuItem[] = display.trackMenuItems()
    expect(labelOf(find(items, 'Filter by...'))).toBe('Filter by...')
    expect(items.some(i => labelOf(i) === 'Edit filters')).toBe(false)

    // hiding a feature adds the unhide recovery, so the group earns a submenu
    display.hideFeature('gene1')
    const filtering = subMenuOf(display.trackMenuItems(), 'Edit filters')
    expect(filtering.map(labelOf)).toEqual([
      'Filter by...',
      'Show 1 hidden feature',
      'Clear all filters',
    ])
  })

  it('does not offer to clear filters for a show-only list that is still being collected', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()

    // ctrl+clicking features collects them; the chip draws boxes and nothing
    // is filtered yet, so the track menu must not claim there are filters
    display.toggleSoloFeature('gene1')
    display.toggleSoloFeature('gene2')
    expect(display.hasFeatureFilters()).toBe(false)
    const collecting: MenuItem[] = display.trackMenuItems()
    expect(collecting.some(i => labelOf(i) === 'Edit filters')).toBe(false)

    // applying it is what filters, and what earns the recovery
    display.applySolo()
    expect(display.hasFeatureFilters()).toBe(true)
    expect(
      subMenuOf(display.trackMenuItems(), 'Edit filters').map(labelOf),
    ).toContain('Clear all filters')

    display.clearAllFeatureFilters()
    expect(display.hasFeatureFilters()).toBe(false)
  })

  it('offers the label rungs as one flat radio group', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    const show = subMenuOf(display.trackMenuItems(), 'Show...')

    // checkboxes first, then the "Labels" subheader and its radios — the split
    // that used to put descriptions in a checkbox and the rest in a radio is
    // gone, so there is exactly one control for what label text is drawn
    expect(show.map(labelOf)).toEqual([
      'Show outline',
      'Show only genes',
      'Show chevrons',
      'Labels',
      'Auto',
      'Name + description',
      'Name only',
      'Description only',
      'None',
      'Subfeature labels',
      'Off',
      'Below',
      'Overlay',
    ])
  })

  it('says so when the chosen label rung is suppressed by collapsed mode', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setShowLabels('nameAndDescription')

    const enabled = find(
      subMenuOf(display.trackMenuItems(), 'Show...'),
      'Name + description',
    )
    expect('subLabel' in enabled ? enabled.subLabel : undefined).toBeUndefined()

    // collapsed drops every label kind, but the mode is deliberately left alone
    // — without the subLabel the row reads as a selected radio doing nothing
    display.setDisplayMode('collapsed')
    const inert = find(
      subMenuOf(display.trackMenuItems(), 'Show...'),
      'Name + description',
    )
    expect(inert.type === 'radio' && inert.checked).toBe(true)
    expect('subLabel' in inert ? inert.subLabel : undefined).toBe(
      'Hidden while collapsed',
    )
  })
})
