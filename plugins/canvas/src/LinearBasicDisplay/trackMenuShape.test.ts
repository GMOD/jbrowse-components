import { resolveSubMenu, staysOpenOnClick } from '@jbrowse/core/ui'

import { STRAND_COLOR_JEXL } from '../RenderFeatureDataRPC/featureColors.ts'
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
    return resolveSubMenu(item)
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
      ['Default', true],
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

  // A pin is reachable only from the pinned feature's own right-click menu, and
  // nothing on screen marks a pinned feature — so a pin left on another locus
  // went on claiming a top row with no affordance anywhere that named it. Its
  // three sibling sets (hidden, show-only, highlights) each had a track-level
  // way back; this one did not.
  it('offers a way to unpin once something is pinned, and not before', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()

    const labels = () => display.trackMenuItems().map(labelOf)
    expect(labels().some((l: unknown) => `${l}`.startsWith('Unpin'))).toBe(
      false,
    )

    display.togglePinnedFeature('gene1')
    display.togglePinnedFeature('gene2')
    // named with the display's own noun, like "Show N hidden features"
    expect(labels()).toContain('Unpin 2 features')

    // and it sinks with the other recovery rows rather than landing among the
    // settings a subclass appends
    const items: MenuItem[] = display.trackMenuItems()
    expect(find(items, 'Unpin 2 features').priority).toBe(
      find(items, 'Filter by...').priority,
    )

    const unpin = find(items, 'Unpin 2 features')
    if ('onClick' in unpin) {
      unpin.onClick()
    }
    expect(display.pinnedFeatureCount).toBe(0)
    expect(labels().some((l: unknown) => `${l}`.startsWith('Unpin'))).toBe(
      false,
    )
  })

  it('offers Filter by... at the top level until a recovery item joins it', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()

    // nothing narrowing the view: one row, no submenu to hover into, and no
    // count on the label
    const items: MenuItem[] = display.trackMenuItems()
    expect(labelOf(find(items, 'Filter by...'))).toBe('Filter by...')

    // hiding a feature adds the unhide recovery, so the group earns a submenu —
    // and the label counts the one filter now hiding features
    display.hideFeature('gene1')
    const filtering = subMenuOf(display.trackMenuItems(), 'Filter by... (1)')
    expect(filtering.map(labelOf)).toEqual([
      'Edit filters...',
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
    expect(display.featureFilterCount()).toBe(0)
    const collecting: MenuItem[] = display.trackMenuItems()
    expect(collecting.some(i => labelOf(i) === 'Filter by... (1)')).toBe(false)

    // applying it is what filters, and what earns the recovery
    display.applySolo()
    expect(display.featureFilterCount()).toBe(1)
    expect(
      subMenuOf(display.trackMenuItems(), 'Filter by... (1)').map(labelOf),
    ).toContain('Clear all filters')

    display.clearAllFeatureFilters()
    expect(display.featureFilterCount()).toBe(0)
  })

  it('counts each independent filter, including a subclass own', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()

    display.hideFeature('gene1')
    expect(display.featureFilterCount()).toBe(1)
    // "Show only genes" is a worker-side admission filter the subclass adds to
    // the base count, so the label has to grow with it
    display.setShowOnlyGenes(true)
    expect(display.featureFilterCount()).toBe(2)
    expect(
      display
        .trackMenuItems()
        .some((i: MenuItem) => labelOf(i) === 'Filter by... (2)'),
    ).toBe(true)
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

    find(subMenuOf(display.trackMenuItems(), 'Show...'), 'Name + description')

    // collapsed drops every label kind, but the mode is deliberately left alone
    // — without the note the row reads as a selected radio doing nothing
    display.setDisplayMode('collapsed')
    const inert = find(
      subMenuOf(display.trackMenuItems(), 'Show...'),
      'Name + description — hidden while collapsed',
    )
    expect(inert.type === 'radio' && inert.checked).toBe(true)
    // The pin names the SETTING, not the row: PinAdornment writes it into
    // "Apply <label> to all open tracks of this type" and into an aria-label,
    // so a hint folded into the option before the pin is attached is read out
    // as part of the setting's name.
    expect('pin' in inert && inert.pin?.label).toBe('Name + description')
  })

  // The two label groups sit adjacent in one submenu under the same
  // suppression — `rpcProps` forces `subfeatureLabels` to 'none' whenever the
  // display mode is collapsed, exactly as it drops the base group's — so one of
  // them saying so and the other not read as the two behaving differently.
  it('says so for the subfeature label rung too', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setSubfeatureLabels('below')
    find(subMenuOf(display.trackMenuItems(), 'Show...'), 'Below')

    display.setDisplayMode('collapsed')
    const inert = find(
      subMenuOf(display.trackMenuItems(), 'Show...'),
      'Below — hidden while collapsed',
    )
    expect(inert.type === 'radio' && inert.checked).toBe(true)
    expect('pin' in inert && inert.pin?.label).toBe('Below')
    // 'Off' is already describing the absence, so it never carries the note
    find(subMenuOf(display.trackMenuItems(), 'Show...'), 'Off')
  })
})

// `color` and `utrColor` are per-feature jexl callback slots
// (contextVariable: ['feature']), so reading one off the display — with no
// feature in scope — evaluates the expression against nothing and throws. These
// two getters feed the "Set color" dialog's swatches, so that throw took the
// dialog down on exactly the tracks whose colors are most worth inspecting. A
// jexl string is not a CSS color anyway, so both fall back to the default swatch,
// the same as an unset slot.
describe('color swatches under a per-feature jexl slot', () => {
  const jexlColor = "jexl:get(feature,'type')=='CDS'?'red':'blue'"

  it('shows the default swatch instead of throwing', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    const plainFeature = display.featureColor
    const plainUtr = display.utrColor
    expect(typeof plainFeature).toBe('string')
    expect(typeof plainUtr).toBe('string')

    display.setFeatureColor(jexlColor)
    display.setUtrColor(jexlColor)
    expect(display.featureColor).toBe(plainFeature)
    expect(display.utrColor).toBe(plainUtr)
  })

  it('still reports the jexl as the active color-by mode', () => {
    // The fallback is a swatch concern only — it must not make the menu read the
    // track as solid-colored when a per-feature expression is driving it.
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setFeatureColor(jexlColor)
    expect(display.colorByMode).toBe('attribute')
  })

  it('keeps a concrete color as the swatch', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setFeatureColor('#ff0000')
    display.setUtrColor('#00ff00')
    expect(display.featureColor).toBe('#ff0000')
    expect(display.utrColor).toBe('#00ff00')
  })
})

// `colorByMode` recognizes the built-in strand expression by string identity, so
// the spelling is load-bearing rather than cosmetic: a track painted by an
// equivalent expression reads back as "color by attribute" and the menu's radio
// lands on the wrong rung. It is spelled the short way the docs teach, so
// someone who writes the documented form by hand gets the mode they see in the
// menu -- which was not true while the constant used `get(feature,'strand')`.
describe('the built-in strand color expression', () => {
  it('is the documented short form, not get(feature,...)', () => {
    expect(STRAND_COLOR_JEXL).toBe(
      "jexl:feature.strand==1?'tomato':feature.strand==-1?'cornflowerblue':'goldenrod'",
    )
  })

  it('round-trips: what the menu writes is what it reads back', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setFeatureColor(STRAND_COLOR_JEXL)
    expect(display.colorByMode).toBe('strand')
  })

  it('is what the Color by... > Strand menu item writes', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    const strand = find(
      subMenuOf(display.trackMenuItems(), 'Color by...'),
      'Strand',
    ) as { onClick: () => void }
    strand.onClick()
    expect(display.colorByMode).toBe('strand')
  })
})

// An unset slot paints a feature's own itemRgb, which no solid swatch can stand
// in for, so it is its own rung rather than reading as "Solid color" — and the
// rung is the way back from Strand without opening the dialog for its Reset.
describe('the Default color rung', () => {
  it('is what an unset color slot reads as', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    expect(display.colorByMode).toBe('default')
  })

  it('unsets the slot the Strand item wrote', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setFeatureColor(STRAND_COLOR_JEXL)
    const item = find(
      subMenuOf(display.trackMenuItems(), 'Color by...'),
      'Default',
    ) as { onClick: () => void }
    item.onClick()
    expect(display.colorByMode).toBe('default')
    expect(display.conf.color).toBeUndefined()
  })
})
