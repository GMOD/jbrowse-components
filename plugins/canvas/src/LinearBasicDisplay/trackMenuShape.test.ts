import { resolveSubMenu, staysOpenOnClick } from '@jbrowse/core/ui'

import { STRAND_COLOR_JEXL } from '../RenderFeatureDataRPC/featureColors.ts'
import { createTestEnvironment } from './testEnv.ts'

import type { MenuItem } from '@jbrowse/core/ui'

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

  it('sinks the recovery items below the settings a subclass appends', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setFeatureHighlights([{ refName: 'ctgA', name: 'gene1' }])

    const items: MenuItem[] = display.trackMenuItems()
    const rendered = items
      .toSorted((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
      .map(labelOf)

    expect(rendered).toEqual([
      'Show...',
      'Set feature height',
      'Color by...',
      'Gene glyph',
      'Clear 1 highlight',
      'Filter by...',
    ])
  })

  it('offers a way to unpin once something is pinned, and not before', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()

    const labels = () => display.trackMenuItems().map(labelOf)
    expect(labels().some((l: unknown) => `${l}`.startsWith('Unpin'))).toBe(
      false,
    )

    display.togglePinnedFeature('gene1')
    display.togglePinnedFeature('gene2')
    expect(labels()).toContain('Unpin 2 features')

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

    const items: MenuItem[] = display.trackMenuItems()
    expect(labelOf(find(items, 'Filter by...'))).toBe('Filter by...')

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

    display.toggleSoloFeature('gene1')
    display.toggleSoloFeature('gene2')
    expect(display.featureFilterCount()).toBe(0)
    const collecting: MenuItem[] = display.trackMenuItems()
    expect(collecting.some(i => labelOf(i) === 'Filter by... (1)')).toBe(false)

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

    display.setDisplayMode('collapsed')
    const inert = find(
      subMenuOf(display.trackMenuItems(), 'Show...'),
      'Name + description — hidden while collapsed',
    )
    expect(inert.type === 'radio' && inert.checked).toBe(true)
    expect('pin' in inert && inert.pin?.label).toBe('Name + description')
  })

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
    find(subMenuOf(display.trackMenuItems(), 'Show...'), 'Off')
  })
})

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
