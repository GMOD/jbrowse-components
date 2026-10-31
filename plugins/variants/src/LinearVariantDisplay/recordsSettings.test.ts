import { resolveSubMenu } from '@jbrowse/core/ui'
import { maxBottom } from '@jbrowse/plugin-features/band'

import { NO_RECORD_FIELD_READS } from '../shared/recordFields.ts'
import { recordsBandSurface } from './components/RecordsBandOverlay.tsx'
import { KIT, recordsDisplayAt } from './recordsBand.fixture.ts'

import type { LinearVariantDisplayModel } from './model.ts'
import type { BandRecord } from './recordsBand.fixture.ts'
import type { MenuItem } from '@jbrowse/core/ui'

const SECTIONED: BandRecord[] = [
  ['a', 1000, 5000, 'DEL', 'DEL', { groupKey: 'Benign' }],
  ['b', 2000, 6000, 'DEL', 'DEL', { groupKey: 'Pathogenic' }],
  ['c', 3000, 7000, 'DEL', 'DEL', { groupKey: 'Benign' }],
]

function items(display: LinearVariantDisplayModel) {
  return display.recordsLaidOutDataMap.get(0)!.flatbushItems
}

function boxHeight(display: LinearVariantDisplayModel) {
  const [item] = items(display)
  return item!.bottomPx - item!.topPx
}

function labelsOf(menu: MenuItem[]) {
  return menu.flatMap(i =>
    'label' in i && typeof i.label === 'string' ? [i.label] : [],
  )
}

function subMenuLabels(menu: MenuItem[], label: string) {
  const item = menu.find(
    i =>
      'label' in i && typeof i.label === 'string' && i.label.startsWith(label),
  )
  return item && 'subMenu' in item ? labelsOf(resolveSubMenu(item)) : []
}

describe('records.displayMode', () => {
  test('unset, compact over rows and normal with none', () => {
    expect(recordsDisplayAt(KIT, 51).display.recordsDisplayMode).toBe('compact')
    expect(
      recordsDisplayAt(KIT, 51, {}, false).display.recordsDisplayMode,
    ).toBe('normal')
  })

  test('collapsed packs every record onto one row with no label', () => {
    const stacked = recordsDisplayAt(KIT, 51).display
    expect(new Set(items(stacked).map(i => i.topPx)).size).toBeGreaterThan(1)
    const { display } = recordsDisplayAt(KIT, 51, { displayMode: 'collapsed' })
    expect(new Set(items(display).map(i => i.topPx))).toEqual(new Set([0]))
    expect(display.recordsRenderedLabels.showLabels).toBe(false)
    expect(display.topBands.recordsHeight).toBeLessThan(
      stacked.topBands.recordsHeight,
    )
  })

  test('a written mode holds with no rows too', () => {
    const { display } = recordsDisplayAt(
      KIT,
      51,
      { displayMode: 'superCompact' },
      false,
    )
    expect(display.recordsDisplayMode).toBe('superCompact')
    expect(display.recordsLayoutInputs.displayMode).toBe('superCompact')
  })
})

test('records.mark.height sizes each record body', () => {
  const bodies = (display: LinearVariantDisplayModel) =>
    items(display).map(i => i.featureHeightPx)
  const base = recordsDisplayAt(KIT, 51).display
  const tall = recordsDisplayAt(KIT, 51, { mark: { height: 20 } }).display
  // compact over rows draws the body at 0.6 of it
  expect(bodies(base)[0]).toBe(6)
  expect(bodies(tall)).toEqual(bodies(base).map(h => h * 2))
  expect(tall.topBands.recordsHeight).toBeGreaterThan(
    base.topBands.recordsHeight,
  )
})

describe('records.facet', () => {
  test('stacks the records in one section per value', () => {
    const { display } = recordsDisplayAt(
      SECTIONED,
      10,
      { facet: 'INFO.CLNSIG' },
      false,
    )
    expect(display.recordFieldReads.facet).toBe('INFO.CLNSIG')
    expect(display.rpcProps().recordFields.facet).toBe('INFO.CLNSIG')
    expect(display.recordsGroupSections.map(s => s.key)).toEqual([
      'Benign',
      'Pathogenic',
    ])
    const [benign, pathogenic] = display.recordsGroupSections
    const top = (id: string) => items(display).find(i => i.featureId === id)!
    expect(top('b').topPx).toBeGreaterThanOrEqual(pathogenic!.top)
    expect(top('a').topPx).toBeLessThan(pathogenic!.top)
    expect(benign!.top).toBe(0)
  })

  test('a hidden section leaves the stack, and comes back', () => {
    const { display } = recordsDisplayAt(
      SECTIONED,
      10,
      { facet: 'INFO.CLNSIG' },
      false,
    )
    display.hideRecordsGroup('Pathogenic')
    expect(display.recordsGroupSections.map(s => s.key)).toEqual(['Benign'])
    display.showAllRecordsGroups()
    expect(display.recordsGroupSections).toHaveLength(2)
  })

  test('is not the sample facet', () => {
    const { display } = recordsDisplayAt(SECTIONED, 10, {}, false)
    display.recordsFacetByField('INFO.CLNSIG')
    expect(display.recordsFacet?.field).toBe('INFO.CLNSIG')
    expect(display.facet).toBeUndefined()
    display.recordsFacetByField('')
    expect(display.recordsFacet).toBeUndefined()
    expect(display.recordsGroupSections).toEqual([])
  })
})

describe('records.tooltip.field', () => {
  function hoverLine(display: LinearVariantDisplayModel) {
    const item = items(display).find(i => i.featureId === 'a')!
    const { bpPerPx, offsetPx } = display.view
    const x = ((item.startBp + item.endBp) / 2 - offsetPx * bpPerPx) / bpPerPx
    const y = (item.topPx + item.bottomPx) / 2
    return recordsBandSurface(display).getHit(x, y)!.fields.featureName
  }

  test('left at the default, the worker reads nothing and the line is the name', () => {
    const { display } = recordsDisplayAt(SECTIONED, 10, {}, false)
    expect(display.rpcProps().recordFields).toEqual(NO_RECORD_FIELD_READS)
    expect(hoverLine(display)).toBe('a')
  })

  test('a field is the worker read the line shows', () => {
    const records: BandRecord[] = [
      ['a', 1000, 5000, 'DEL', 'DEL', { tooltip: 'Pathogenic' }],
    ]
    const { display } = recordsDisplayAt(
      records,
      10,
      { tooltip: 'INFO.CLNSIG' },
      false,
    )
    expect(display.rpcProps().recordFields.tooltip).toBe('INFO.CLNSIG')
    expect(hoverLine(display)).toBe('Pathogenic')
  })
})

describe('the record menus', () => {
  test('with no rows, the label parts, Feature height and Group by', () => {
    const { display } = recordsDisplayAt(KIT, 51, {}, false)
    const menu = display.trackMenuItems()
    expect(subMenuLabels(menu, 'Show')).toEqual(
      expect.arrayContaining(['Names', 'Descriptions']),
    )
    expect(subMenuLabels(menu, 'Group by')).toEqual(['None', 'Field...'])
    display.setRecordsLabelShow('description', false)
    expect(display.recordsLabels.description).toBe('')
    display.setRecordsDisplayMode('collapsed')
    expect(display.recordsDisplayMode).toBe('collapsed')
  })

  test('over rows, Row height is the one height menu, drawn band or not', () => {
    for (const records of [{ show: false }, {}]) {
      const menu = recordsDisplayAt(KIT, 51, records).display.trackMenuItems()
      expect(labelsOf(menu)).toContain('Row height')
      expect(labelsOf(menu)).not.toContain('Feature height')
      expect(subMenuLabels(menu, 'Show')).not.toContain('Names')
    }
  })

  test('records.facet hides from the sample Group by over rows', () => {
    const { display } = recordsDisplayAt(KIT, 51, { facet: 'INFO.CLNSIG' })
    expect(subMenuLabels(display.trackMenuItems(), 'Group by')).not.toContain(
      'Field (INFO.CLNSIG)...',
    )
  })
})

test('maxBottom of a collapsed band is one row', () => {
  const { display } = recordsDisplayAt(KIT, 51, { displayMode: 'collapsed' })
  expect(maxBottom(display.recordsLaidOutDataMap)).toBe(boxHeight(display))
})

describe('encoding.color identity', () => {
  const identity = {
    value: "jexl:get(feature,'INFO').COLOR",
    scale: {
      type: 'identity',
      domain: ['#d73027', '#4575b4'],
      names: ['Pathogenic', 'Benign'],
    },
  }

  test('paints the callback and keys the colors the domain names', () => {
    const { display } = recordsDisplayAt(KIT, 51, {}, true, {
      encoding: { color: identity },
    })
    expect(display.cellHueRead).toBe(identity.value)
    const key = display.colorScales.find(s => s.id === 'identity')
    expect(
      key?.kind === 'categorical' && key.entries.map(e => [e.label, e.color]),
    ).toEqual(
      expect.arrayContaining([
        ['Pathogenic', '#d73027'],
        ['Benign', '#4575b4'],
      ]),
    )
  })

  test('a callback with no identity scale keys nothing', () => {
    const { display } = recordsDisplayAt(KIT, 51, {}, true, {
      encoding: { color: { value: identity.value } },
    })
    expect(display.colorScales.find(s => s.id === 'identity')).toBeUndefined()
  })
})
