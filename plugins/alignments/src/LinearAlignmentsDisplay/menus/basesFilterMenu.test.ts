import { basesFilterOf, withBasesFields } from '../../shared/basesFilter.ts'
import { declaredFiltersOf } from '../dialogs/layerFilters.ts'
import { clickMenuItem } from '../testUtils.ts'
import { basesFilterNarrowing } from './basesFilterMenu.ts'
import { cytosineContextItems } from './modificationsMenu.ts'

import type {
  BaseColorField,
  BaseLayer,
  BasesPatch,
} from '../../shared/types.ts'
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
    declaredFilters: declaredFiltersOf([], []),
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

describe('the per-base refinements in the Filter by count', () => {
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

  // the context picks what the coloring scores, a Color by choice
  test('a context is not a filter: it neither counts nor clears', () => {
    const context = { field: 'context', oneOf: ['CHH'] }
    const model = makeModel('bisulfite', { filter: [context] })
    const narrowing = basesFilterNarrowing(model)
    expect(narrowing.count).toBe(0)
    narrowing.clear()
    expect(model.bases.filter).toEqual([context])
  })

  test('nothing counts with the layer off', () => {
    const model = makeModel(undefined, {
      filter: [{ field: 'probability', gte: 0.8 }],
    })
    expect(basesFilterNarrowing(model).count).toBe(0)
  })
})

describe('the Cytosine context row in Color by', () => {
  const rowsFor = (
    field: BaseColorField | undefined,
    opts: Parameters<typeof makeModel>[1] & { ready?: boolean } = {},
  ) => {
    const model = Object.assign(makeModel(field, opts), {
      modificationsReady: opts.ready ?? true,
    })
    return { model, rows: () => cytosineContextItems(model) }
  }

  test('bisulfite offers it with or without the blue view', () => {
    expect(rowsFor('bisulfite').rows()).toHaveLength(1)
    expect(rowsFor('bisulfite', { unmodified: true }).rows()).toHaveLength(1)
  })

  test('5mC offers it only in the blue view, which paints every cytosine', () => {
    expect(rowsFor('modifications').rows()).toHaveLength(0)
    expect(rowsFor('modifications', { unmodified: true }).rows()).toHaveLength(
      1,
    )
  })

  test('the blue view keeps it while detection runs, and drops it once no cytosine calls are found', () => {
    expect(
      rowsFor('modifications', {
        unmodified: true,
        types: [],
        ready: false,
      }).rows(),
    ).toHaveLength(1)
    expect(
      rowsFor('modifications', { unmodified: true, types: ['a'] }).rows(),
    ).toHaveLength(0)
    expect(
      rowsFor('modifications', {
        unmodified: true,
        types: ['a'],
        filter: [{ field: 'context', oneOf: ['CHG'] }],
      }).rows(),
    ).toHaveLength(1)
  })

  test('the other per-base colorings do not offer it', () => {
    expect(rowsFor('baseQuality').rows()).toHaveLength(0)
    expect(rowsFor(undefined).rows()).toHaveLength(0)
  })

  test('picking a context writes it, and CpG returns to the default', () => {
    const { model, rows } = rowsFor('bisulfite')
    clickMenuItem(rows(), 'CHH')
    expect(model.basesFilter.context).toBe('CHH')
    expect(model.bases.filter).toEqual([{ field: 'context', oneOf: ['CHH'] }])
    clickMenuItem(rows(), 'CpG')
    expect(model.basesFilter.context).toBe('CG')
    expect(model.bases.filter).toEqual([])
  })
})
