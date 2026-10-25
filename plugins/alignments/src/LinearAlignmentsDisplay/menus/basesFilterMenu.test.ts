import { isValidElement } from 'react'

import { resolveSubMenu } from '@jbrowse/core/ui'

import { basesFilterOf, withBasesFields } from '../../shared/basesFilter.ts'
import { basesFilterNarrowing, getBasesFilterItems } from './basesFilterMenu.ts'

import type {
  BaseColorField,
  BaseLayer,
  BasesPatch,
} from '../../shared/types.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { FieldPredicate } from '@jbrowse/core/util/fieldPredicate'

// Mirrors the display's `pileup.bases`, whose `unmodified` and `filter`
// outlive a switch to another layer
function makeModel(
  field: BaseColorField | undefined,
  {
    types = ['m', 'h'],
    unmodified = false,
    filter = [],
  }: { types?: string[]; unmodified?: boolean; filter?: FieldPredicate[] } = {},
) {
  return {
    detectedModificationTypes: types,
    bases: { show: field !== undefined, field, unmodified, filter },
    get baseLayer(): BaseLayer | undefined {
      const { show, field, unmodified, filter } = this.bases
      return !show || field === undefined
        ? undefined
        : field === 'modifications' || field === 'bisulfite'
          ? { field, unmodified, filter: basesFilterOf(filter) }
          : { field }
    },
    get basesFilter() {
      return basesFilterOf(this.bases.filter)
    },
    setBases({ show, field, unmodified, filter }: BasesPatch) {
      const { bases } = this
      this.bases = {
        show: show ?? bases.show,
        field: field ?? bases.field,
        unmodified: unmodified ?? bases.unmodified,
        filter: withBasesFields(bases.filter, filter ?? {}),
      }
    },
  }
}

type Model = ReturnType<typeof makeModel>

const labelsOf = (model: Model) =>
  getBasesFilterItems(model).map(i => ('label' in i ? i.label : ''))

function row(model: Model, label: string) {
  const item = getBasesFilterItems(model).find(
    i => 'label' in i && i.label === label,
  )
  if (!item || !('subMenu' in item)) {
    throw new Error(`no "${label}" submenu`)
  }
  return resolveSubMenu(item)
}

function click(items: MenuItem[], label: string) {
  const item = items.find(i => 'label' in i && i.label === label)
  if (!item || !('onClick' in item)) {
    throw new Error(`no clickable "${label}"`)
  }
  item.onClick({})
}

const TYPES = 'Modification types'
const PROBABILITY = 'Modification probability'
const CONTEXT = 'Cytosine context'

describe('Filter by... rows over the per-base layer', () => {
  // A refinement writes the filter alone, so one reachable under another layer
  // would change what this one draws when next picked.
  test.each([
    [undefined, false, []],
    ['baseQuality', false, []],
    ['modifications', false, [TYPES, PROBABILITY]],
    ['modifications', true, [TYPES, CONTEXT]],
    ['bisulfite', false, [CONTEXT]],
    ['bisulfite', true, [CONTEXT]],
  ] as const)('%s, unmodified %s, offers %j', (field, unmodified, labels) => {
    expect(labelsOf(makeModel(field, { unmodified }))).toEqual(labels)
  })

  test('the type list is hidden when only one type is detected', () => {
    expect(labelsOf(makeModel('modifications', { types: ['m'] }))).toEqual([
      PROBABILITY,
    ])
  })

  // a list unticking the only type in view hides every mark, so its row stays
  test('the type list stays while a type is unticked, even with one type in view', () => {
    const model = makeModel('modifications', {
      types: ['m'],
      filter: [{ field: 'code', oneOf: ['h'] }],
    })
    expect(labelsOf(model)).toEqual([TYPES, PROBABILITY])
  })

  test('cytosine context is offered only for cytosine methylation data', () => {
    expect(
      labelsOf(makeModel('modifications', { types: ['a'], unmodified: true })),
    ).toEqual([])
  })

  test('every detected type starts ticked', () => {
    const model = makeModel('modifications')
    expect(
      row(model, TYPES).map(i => [
        'label' in i ? i.label : '',
        'checked' in i ? i.checked : undefined,
      ]),
    ).toEqual([
      ['5mC', true],
      ['5hmC', true],
    ])
  })

  test('types are independent: two can be unticked', () => {
    const model = makeModel('modifications', { types: ['m', 'h', 'a'] })
    click(row(model, TYPES), '5hmC')
    click(row(model, TYPES), '6mA')
    expect(model.bases.filter).toEqual([{ field: 'code', oneOf: ['m'] }])
  })

  test('re-ticking every type writes no code, so types found later stay visible', () => {
    const model = makeModel('modifications', {
      filter: [{ field: 'code', oneOf: ['m'] }],
    })
    click(row(model, TYPES), '5hmC')
    expect(model.bases.filter).toEqual([])
  })

  // no code entry draws every type, so the layer goes off rather than
  // silently drawing all
  test('unticking the last type turns the layer off', () => {
    const model = makeModel('modifications', {
      filter: [{ field: 'code', oneOf: ['m'] }],
    })
    click(row(model, TYPES), '5mC')
    expect(model.baseLayer).toBeUndefined()
  })

  test('a context pick writes the context and keeps the rest of the filter', () => {
    const floor = { field: 'probability', gte: 0.4 }
    const model = makeModel('bisulfite', { filter: [floor] })
    click(row(model, CONTEXT), 'CHH')
    expect(model.bases.filter).toEqual([
      floor,
      { field: 'context', oneOf: ['CHH'] },
    ])
  })

  // The threshold is the shared makeSizeMenu row, so assert through its props.
  function thresholdSlider(model: Model) {
    const [item] = row(model, PROBABILITY)
    if (!item || !('render' in item)) {
      throw new Error('no threshold slider')
    }
    // makeSizeMenu renders the row through `lazy()`, so `render()` hands back a
    // Suspense boundary whose only child is the row (ui/makeSizeMenu.tsx)
    const boundary = item.render(() => {})
    const rendered = isValidElement(boundary)
      ? (boundary.props as { children?: unknown }).children
      : undefined
    if (!isValidElement(rendered)) {
      throw new Error('threshold slider did not render')
    }
    return rendered.props as {
      onChange: (v: number) => void
      onReset: () => void
      isDefault: boolean
      commitOnRelease: boolean
    }
  }

  test('the threshold slider writes a probability floor, and resets', () => {
    const model = makeModel('modifications')
    const { onChange, onReset, isDefault, commitOnRelease } =
      thresholdSlider(model)
    expect(isDefault).toBe(true)
    expect(commitOnRelease).toBe(true)
    onChange(80)
    expect(model.bases.filter).toEqual([{ field: 'probability', gte: 0.8 }])
    onReset()
    expect(model.bases.filter).toEqual([])
  })

  test('a gt floor at the default threshold is not the default, and resets to it', () => {
    const model = makeModel('modifications', {
      filter: [{ field: 'probability', gt: 0.1 }],
    })
    const { onReset, isDefault } = thresholdSlider(model)
    expect(isDefault).toBe(false)
    onReset()
    expect(model.bases.filter).toEqual([])
  })

  test('a floor the slider rounds to the default is not the default', () => {
    const model = makeModel('modifications', {
      filter: [{ field: 'probability', gte: 0.10004 }],
    })
    expect(thresholdSlider(model).isDefault).toBe(false)
  })
})

describe('the per-base refinements in the Filter by... count', () => {
  test('nothing counts at the defaults', () => {
    expect(basesFilterNarrowing(makeModel('modifications')).count).toBe(0)
  })

  test('a raised floor and an unticked type count, and clear', () => {
    const model = makeModel('modifications', {
      filter: [
        { field: 'probability', gte: 0.8 },
        { field: 'code', oneOf: ['m'] },
      ],
    })
    const narrowing = basesFilterNarrowing(model)
    expect(narrowing.count).toBe(2)
    narrowing.clear()
    expect(model.bases.filter).toEqual([])
  })

  // the 2-color view paints every call, so its floor changes nothing drawn
  test('a floor the drawn view ignores does not count, and survives a clear', () => {
    const floor = { field: 'probability', gte: 0.8 }
    const model = makeModel('modifications', {
      unmodified: true,
      filter: [floor],
    })
    const narrowing = basesFilterNarrowing(model)
    expect(narrowing.count).toBe(0)
    narrowing.clear()
    expect(model.bases.filter).toEqual([floor])
  })

  test('a context under bisulfite counts', () => {
    const model = makeModel('bisulfite', {
      filter: [{ field: 'context', oneOf: ['CHH'] }],
    })
    expect(basesFilterNarrowing(model).count).toBe(1)
  })

  test('nothing counts with the layer off', () => {
    const model = makeModel(undefined, {
      filter: [{ field: 'probability', gte: 0.8 }],
    })
    expect(basesFilterNarrowing(model).count).toBe(0)
  })
})
