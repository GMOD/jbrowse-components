import { isValidElement } from 'react'

import { resolveSubMenu, staysOpenOnClick } from '@jbrowse/core/ui'

import { basesFilterOf, withBasesField } from '../../shared/basesFilter.ts'
import { colorFieldOptions } from '../../shared/colorFieldOptions.ts'
import { getColorByMenuItem } from './colorBy.ts'

import type {
  BaseColorField,
  BaseLayer,
  BasesPatch,
} from '../../shared/types.ts'
import type { Plot } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'
import type { FieldPredicate } from '@jbrowse/core/util/fieldPredicate'

// Minimal model: enough for schemeRadios + the Paired end submenu (modModel is
// "defined" whenever modificationsReady is set, even to false).
function makeModel() {
  return {
    colorField: '',
    colorEncoding: undefined,
    writtenColor: {},
    colorByField(field: string) {
      this.colorField = field
    },
    applyPlot(_draft: Plot) {},
    pickDefaultColor() {},
    pickSolidColor() {},
    parkColor() {},
    // Mirrors the display's `pileup.bases`, whose `unmodified` and `filter`
    // outlive a switch to another layer
    bases: {
      show: false,
      field: undefined as BaseColorField | undefined,
      unmodified: false,
      filter: [] as FieldPredicate[],
    },
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
        filter: Object.entries(filter ?? {}).reduce(
          (list, [name, entries]) => withBasesField(list, name, entries),
          bases.filter,
        ),
      }
    },
    modificationsReady: false,
    regionTooLarge: false,
    detectedModificationTypes: [] as string[],
  }
}

// The model drawing `field`, with the `pileup.bases` members `rest` names
function drawing(
  model: ReturnType<typeof makeModel>,
  field: BaseColorField,
  rest: { unmodified?: boolean; filter?: FieldPredicate[] } = {},
) {
  model.bases = {
    show: true,
    field,
    unmodified: rest.unmodified ?? false,
    filter: rest.filter ?? [],
  }
}

type Model = ReturnType<typeof makeModel>

function subMenuOf(item: MenuItem | undefined) {
  return item && 'subMenu' in item ? resolveSubMenu(item) : []
}

// Flatten the Color by... menu so the scheme radios and those nested under
// "Paired end" and "Per-base coloring" are reachable by label. These specs describe the
// alignments display's menu, which opts into every section — a caller that opts
// out is covered by the curation tests below.
function allItems(
  model: Model,
  opts?: Parameters<typeof getColorByMenuItem>[1],
) {
  const top = subMenuOf(
    getColorByMenuItem(model, {
      includePairedEnd: true,
      includeModifications: true,
      ...opts,
    }),
  )
  return flatten(top)
}

function flatten(items: MenuItem[]): MenuItem[] {
  return items.flatMap(i =>
    'subMenu' in i ? [i, ...flatten(resolveSubMenu(i))] : [i],
  )
}

function byLabel(
  model: Model,
  label: string,
  opts?: Parameters<typeof getColorByMenuItem>[1],
) {
  return allItems(model, opts).find(i => 'label' in i && i.label === label)
}

describe('color by menu', () => {
  // The tag radio is the only scheme whose choice carries a parameter, and it
  // was invisible without reopening the dialog.
  test('the tag radio names the tag in use', () => {
    const model = makeModel()
    const labels = (m: Model) =>
      allItems(m, { includeTagOption: true })
        .map(i => ('label' in i ? String(i.label) : ''))
        .filter(l => l.startsWith('Tag'))
    expect(labels(model)).toEqual(['Tag...'])
    model.colorField = 'tags.HP'
    expect(labels(model)).toEqual(['Tag (HP)...'])
  })

  // A radio row keeps the menu open by its type, which is right for every row
  // that just writes a scheme — users try several, and the menu is an observer so
  // the ticks move live. The tag row is the one exception: its click opens a
  // dialog, so it opts out with keepMenuOpen: false, or the dialog appears behind
  // a menu the user then has to dismiss. Solid color opens its picker likewise.
  test('scheme rows stay open, the tag and solid color rows (dialogs) dismiss', () => {
    const model = makeModel()
    const rows = allItems(model, { includeTagOption: true }).filter(
      i => 'checked' in i,
    )
    expect(rows.length).toBeGreaterThan(1)
    for (const row of rows) {
      const label = 'label' in row ? String(row.label) : ''
      expect([label, staysOpenOnClick(row)]).toEqual([
        label,
        !label.startsWith('Tag') && label !== 'Solid color...',
      ])
    }
  })
})

// A ready display carrying the given modification types, so the "Color by
// modifications" submenu is built rather than the loading placeholder.
function makeModModel(types = ['m', 'h']) {
  const model = makeModel()
  model.modificationsReady = true
  model.detectedModificationTypes = types
  return model
}

function clickRadio(model: Model, label: string) {
  const item = byLabel(model, label)
  if (!item || !('onClick' in item)) {
    throw new Error(`no clickable "${label}"`)
  }
  item.onClick({})
}

// The bisulfite rows by name: "CHG" also names a cytosine context in the
// modifications submenu.
function bisulfiteRow(model: Model, label: string) {
  return subMenuOf(byLabel(model, 'Bisulfite / EM-seq')).find(
    i => 'label' in i && i.label === label,
  )
}

function clickBisulfite(model: Model, label: string) {
  const item = bisulfiteRow(model, label)
  if (!item || !('onClick' in item)) {
    throw new Error(`no clickable bisulfite "${label}"`)
  }
  item.onClick({})
}

const BY_TYPE = 'One color per modification type'
const TWO_COLOR =
  'One color per type, plus low-probability & unmodified in blue'

describe('color by modifications menu', () => {
  const controls = [BY_TYPE, TWO_COLOR, 'Probability threshold']

  test.each([false, true])(
    'shows the same controls in either view (unmodified %s)',
    unmodified => {
      const model = makeModModel()
      drawing(model, 'modifications', { unmodified })
      for (const label of controls) {
        expect(byLabel(model, label)).toBeTruthy()
      }
    },
  )

  test('switching to another layer and back keeps the filter', () => {
    const model = makeModModel(['m', 'h'])
    const filter = [
      { field: 'probability', gte: 0.4 },
      { field: 'code', oneOf: ['m'] },
    ]
    drawing(model, 'modifications', { filter })
    model.setBases({ show: false })
    clickRadio(model, BY_TYPE)
    expect(model.bases.filter).toEqual(filter)

    clickBisulfite(model, 'CHG')
    expect(model.bases).toEqual({
      show: true,
      field: 'bisulfite',
      unmodified: false,
      filter: [...filter, { field: 'context', oneOf: ['CHG'] }],
    })
    clickRadio(model, BY_TYPE)
    expect(model.bases.filter).toEqual([
      ...filter,
      { field: 'context', oneOf: ['CHG'] },
    ])
  })

  // One `unmodified` member serves both layers: bisulfite's "Show
  // unmethylated" reads it and a context pick leaves it be, so the
  // methylation view survives a visit to bisulfite.
  test('the fill view comes back after bisulfite, and bisulfite reads it as on', () => {
    const model = makeModModel(['m', 'h'])
    drawing(model, 'modifications', { unmodified: true })
    clickBisulfite(model, 'CHG')
    const unmethylated = bisulfiteRow(model, 'Show unmethylated (blue)')
    expect(
      unmethylated && 'checked' in unmethylated && unmethylated.checked,
    ).toBe(true)
    clickRadio(model, TWO_COLOR)
    expect(model.bases.unmodified).toBe(true)

    clickBisulfite(model, 'CHH')
    clickBisulfite(model, 'Show unmethylated (blue)')
    expect(model.bases.unmodified).toBe(false)
  })

  test.each([['m', 'h'], ['a']])(
    'the 2-color radio shows the unmodified side, whatever the data (%s)',
    (...types) => {
      const model = makeModModel(types)
      drawing(model, 'modifications')
      clickRadio(model, TWO_COLOR)
      expect(model.baseLayer).toMatchObject({
        field: 'modifications',
        unmodified: true,
      })
    },
  )

  test('the fill view reads as the "2-color" radio, not a separate row', () => {
    const model = makeModModel()
    drawing(model, 'modifications', { unmodified: true })
    const prob = byLabel(model, TWO_COLOR)
    expect(prob && 'checked' in prob && prob.checked).toBe(true)
  })

  test('switching views preserves refinements (cytosine context)', () => {
    const model = makeModModel()
    const filter = [{ field: 'context', oneOf: ['CHH'] }]
    drawing(model, 'modifications', { unmodified: true, filter })
    clickRadio(model, BY_TYPE)
    expect(model.bases).toMatchObject({ unmodified: false, filter })
  })

  function tickModType(model: ReturnType<typeof makeModModel>, label: string) {
    const item = subMenuOf(byLabel(model, 'Modification types')).find(
      i => 'label' in i && i.label === label,
    )
    if (!item || !('onClick' in item)) {
      throw new Error(`no ${label} checkbox`)
    }
    item.onClick({})
  }

  test('every detected type starts ticked', () => {
    const model = makeModModel(['m', 'h'])
    drawing(model, 'modifications')
    expect(
      subMenuOf(byLabel(model, 'Modification types')).map(i => [
        'label' in i ? i.label : '',
        'checked' in i ? i.checked : undefined,
      ]),
    ).toEqual([
      ['5mC', true],
      ['5hmC', true],
    ])
  })

  test('unticking one type leaves the rest drawn', () => {
    const model = makeModModel(['m', 'h', 'a'])
    drawing(model, 'modifications')
    tickModType(model, '5hmC')
    expect(model.bases.filter).toEqual([{ field: 'code', oneOf: ['m', 'a'] }])
  })

  test('types are independent — two can be unticked, unlike the old radio', () => {
    const model = makeModModel(['m', 'h', 'a'])
    drawing(model, 'modifications')
    tickModType(model, '5hmC')
    tickModType(model, '6mA')
    expect(model.bases.filter).toEqual([{ field: 'code', oneOf: ['m'] }])
  })

  test('re-ticking every type writes no code, so types found later stay visible', () => {
    const model = makeModModel(['m', 'h'])
    drawing(model, 'modifications', {
      filter: [{ field: 'code', oneOf: ['m'] }],
    })
    tickModType(model, '5hmC')
    expect(model.bases.filter).toEqual([])
  })

  // no code entry draws every type, so the layer goes off rather than
  // silently drawing all
  test('unticking the last type turns the layer off', () => {
    const model = makeModModel(['m', 'h'])
    drawing(model, 'modifications', {
      filter: [{ field: 'code', oneOf: ['m'] }],
    })
    tickModType(model, '5mC')
    expect(model.baseLayer).toBeUndefined()
  })

  test('the per-type filter is hidden when only one type is detected', () => {
    const model = makeModModel(['m'])
    drawing(model, 'modifications')
    expect(byLabel(model, 'Modification types')).toBeFalsy()
  })

  // A refinement writes the filter alone, so one reachable under bisulfite
  // would change what the modifications layer draws when next picked.
  test.each([
    'Modification types',
    'Probability threshold',
    'Cytosine context',
  ])('%s is revealed only while the modifications scheme is active', label => {
    const model = makeModModel(['m', 'h'])
    drawing(model, 'bisulfite')
    expect(byLabel(model, label)).toBeFalsy()

    drawing(model, 'modifications')
    expect(byLabel(model, label)).toBeTruthy()
  })

  // The threshold is the shared makeSizeMenu row, so assert through its props.
  function thresholdSlider(model: Model) {
    const item = byLabel(model, 'Probability threshold')
    if (!item || !('render' in item)) {
      throw new Error('no threshold slider')
    }
    // makeSizeMenu renders the row through `lazy()`, so `render()` hands back a
    // Suspense boundary whose only child is the row — see ui/makeSizeMenu.tsx
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

  test('the threshold slider sits inline in Modifications, writes a probability floor, and resets', () => {
    const model = makeModModel(['m', 'h'])
    drawing(model, 'modifications')
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
    const model = makeModModel(['m', 'h'])
    drawing(model, 'modifications', {
      filter: [{ field: 'probability', gt: 0.1 }],
    })
    const { onReset, isDefault } = thresholdSlider(model)
    expect(isDefault).toBe(false)
    onReset()
    expect(model.bases.filter).toEqual([])
  })

  test('a floor the slider rounds to the default is not the default', () => {
    const model = makeModModel(['m', 'h'])
    drawing(model, 'modifications', {
      filter: [{ field: 'probability', gte: 0.10004 }],
    })
    expect(thresholdSlider(model).isDefault).toBe(false)
  })

  test('cytosine context is shown only for cytosine methylation data', () => {
    const cytosine = makeModModel(['m', 'h'])
    drawing(cytosine, 'modifications')
    expect(byLabel(cytosine, 'Cytosine context')).toBeTruthy()

    const other = makeModModel(['a'])
    drawing(other, 'modifications')
    expect(byLabel(other, 'Cytosine context')).toBeFalsy()
  })

  // Detection is per-fetch volatile state, so a track colored by modifications
  // can land on a region whose reads carry no MM/ML calls. Dropping the submenu
  // then left the whole Color by... menu with nothing checked.
  test('the submenu stays while it is the active scheme, with nothing detected', () => {
    const model = makeModModel([])
    drawing(model, 'modifications')
    expect(byLabel(model, BY_TYPE)).toBeTruthy()
    expect(allItems(model).some(i => 'checked' in i && i.checked)).toBe(true)
  })

  test('a ready display with no detected types and another scheme active omits it', () => {
    const model = makeModModel([])
    expect(byLabel(model, BY_TYPE)).toBeFalsy()
    expect(byLabel(model, 'Bisulfite / EM-seq')).toBeTruthy()
  })
})

// A display that composes the alignments state model (LGVSyntenyDisplay does)
// carries every modification field, so the menu cannot infer from the model's
// shape that pairs/modifications are meaningless for it — the caller says so.
describe('color by menu curation', () => {
  const labelsFor = (opts: Parameters<typeof getColorByMenuItem>[1]) =>
    subMenuOf(getColorByMenuItem(makeModel(), opts)).map(i =>
      'label' in i ? i.label : '',
    )
  const deepLabelsFor = (opts: Parameters<typeof getColorByMenuItem>[1]) =>
    flatten(subMenuOf(getColorByMenuItem(makeModel(), opts))).map(i =>
      'label' in i ? i.label : '',
    )

  test('paired-end and modification sections are absent unless opted into', () => {
    const labels = deepLabelsFor({})
    expect(labels).not.toContain('Paired end')
    expect(labels).not.toContain('Bisulfite / EM-seq')
    expect(labels).not.toContain('Tag...')
  })

  test('each section is opted into independently', () => {
    expect(deepLabelsFor({ includePairedEnd: true })).toContain('Paired end')
    expect(deepLabelsFor({ includePairedEnd: true })).not.toContain(
      'Bisulfite / EM-seq',
    )
    expect(deepLabelsFor({ includeModifications: true })).toContain(
      'Bisulfite / EM-seq',
    )
    expect(deepLabelsFor({ includeModifications: true })).not.toContain(
      'Paired end',
    )
  })

  test('curated colorOptions replace the basic radios', () => {
    expect(
      labelsFor({ colorOptions: colorFieldOptions('', 'mateRefName') }),
    ).toEqual(['Normal', 'Mate chromosome', 'Solid color...'])
  })

  test('a curated entry can relabel one scheme for its own display', () => {
    expect(
      labelsFor({
        colorOptions: colorFieldOptions('', {
          field: 'mateRefName',
          label: 'Query name',
        }),
      }),
    ).toEqual(['Normal', 'Query name', 'Solid color...'])
  })

  // Everything behind the scheme is already wired for a BAM (the worker reads
  // the mate refName off next_ref, readFillColors bakes it, the legend names its
  // empty bucket "No mate"); it just had no row to reach it from.
  // One radio group in the top menu, so one row reads as ticked: the per-base
  // layer's radios sit in their own submenu.
  test('per-base coloring is a submenu, not a second radio group', () => {
    const model = makeModel()
    drawing(model, 'modifications')
    const top = subMenuOf(
      getColorByMenuItem(model, { includeModifications: true }),
    )
    expect(top.filter(i => 'checked' in i && i.checked)).toHaveLength(1)
    expect(top.some(i => i.type === 'subHeader')).toBe(false)
  })

  test('mate chromosome is reachable from the paired-end submenu', () => {
    const model = makeModel()
    // clickRadio throws if the row isn't there or isn't clickable, so reaching
    // the assertion is itself the "it is offered" half
    clickRadio(model, 'Mate chromosome')
    expect(model.colorField).toBe('mateRefName')
  })
})
