import { resolveSubMenu, staysOpenOnClick } from '@jbrowse/core/ui'

import { basesFilterOf, withBasesFields } from '../../shared/basesFilter.ts'
import { colorFieldOptions } from '../../shared/colorFieldOptions.ts'
import {
  BISULFITE_LABEL,
  MODIFICATIONS_LABEL,
  UNMODIFIED_IN_BLUE_LABEL,
} from './baseLayerLabels.ts'
import { getColorByMenuItem } from './colorBy.ts'

import type {
  BaseColorField,
  BaseLayer,
  BasesPatch,
} from '../../shared/types.ts'
import type { Plot } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'
import type { FieldPredicate } from '@jbrowse/core/util/fieldPredicate'

// Minimal model: enough for the field radios + the Paired end submenu (modModel is
// "defined" whenever modificationsReady is set, even to false).
function makeModel() {
  return {
    colorField: undefined as string | undefined,
    colorEncoding: undefined,
    writtenColor: {},
    colorByField(field: string | undefined) {
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
        filter: withBasesFields(bases.filter, filter ?? {}),
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

// Flatten the Color by... menu so the field radios and those nested under
// "Paired end" are reachable by label. These specs describe the
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
  // The tag radio is the only field whose choice carries a parameter, and it
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
  // that just writes a field — users try several, and the menu is an observer so
  // the ticks move live. The tag row is the one exception: its click opens a
  // dialog, so it opts out with keepMenuOpen: false, or the dialog appears behind
  // a menu the user then has to dismiss. Solid color opens its picker likewise.
  test('field rows stay open, the tag and solid color rows (dialogs) dismiss', () => {
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

// A ready display carrying the given modification types, so the modification
// radios are built rather than the loading placeholder.
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

function isChecked(model: Model, label: string) {
  const item = byLabel(model, label)
  return !!item && 'checked' in item && item.checked
}

const BY_TYPE = MODIFICATIONS_LABEL
const IN_BLUE = UNMODIFIED_IN_BLUE_LABEL

describe('color by modifications radios', () => {
  test.each([false, true])(
    'one radio, and the blue view as a checkbox (unmodified %s)',
    unmodified => {
      const model = makeModModel()
      drawing(model, 'modifications', { unmodified })
      expect([isChecked(model, BY_TYPE), isChecked(model, IN_BLUE)]).toEqual([
        true,
        unmodified,
      ])
    },
  )

  test('switching to another layer and back keeps the filter', () => {
    const model = makeModModel(['m', 'h'])
    const filter = [
      { field: 'probability', gte: 0.4 },
      { field: 'code', oneOf: ['m'] },
      { field: 'context', oneOf: ['CHG'] },
    ]
    drawing(model, 'modifications', { filter })
    clickRadio(model, BISULFITE_LABEL)
    expect(model.bases).toEqual({
      show: true,
      field: 'bisulfite',
      unmodified: false,
      filter,
    })
    clickRadio(model, BY_TYPE)
    expect(model.bases.filter).toEqual(filter)
  })

  test.each([
    [BY_TYPE, 'modifications'],
    [BISULFITE_LABEL, 'bisulfite'],
  ] as const)('%s draws %s', (label, field) => {
    const model = makeModModel(['m', 'h'])
    clickRadio(model, label)
    expect(model.baseLayer).toMatchObject({ field, unmodified: false })
    expect(isChecked(model, label)).toBe(true)
  })

  test.each(['modifications', 'bisulfite'] as const)(
    'the checkbox paints the unmodified side blue under %s, and keeps it on a switch',
    field => {
      const model = makeModModel(['m', 'h'])
      drawing(model, field)
      clickRadio(model, IN_BLUE)
      expect(model.baseLayer).toMatchObject({ field, unmodified: true })
      clickRadio(model, field === 'bisulfite' ? BY_TYPE : BISULFITE_LABEL)
      expect(isChecked(model, IN_BLUE)).toBe(true)
    },
  )

  test('the checkbox is offered only while a methylation layer draws', () => {
    const model = makeModModel(['m', 'h'])
    expect(byLabel(model, IN_BLUE)).toBeFalsy()
    drawing(model, 'baseQuality')
    expect(byLabel(model, IN_BLUE)).toBeFalsy()
  })

  test('one radio in the per-base group reads as ticked', () => {
    const model = makeModModel(['m', 'h'])
    drawing(model, 'bisulfite', { unmodified: true })
    expect([BY_TYPE, BISULFITE_LABEL].filter(l => isChecked(model, l))).toEqual(
      [BISULFITE_LABEL],
    )
  })

  test('the Modifications radio greys out while the reads are being read', () => {
    const model = makeModModel([])
    model.modificationsReady = false
    const item = byLabel(model, BY_TYPE)
    expect(item && 'disabled' in item && item.disabled).toBe(true)
  })

  // Detection is per-fetch volatile state, so a track colored by modifications
  // can land on a region whose reads carry no MM/ML calls. Dropping the radios
  // then left the per-base group with nothing checked.
  test('the radios stay while modifications is the active field, with nothing detected', () => {
    const model = makeModModel([])
    drawing(model, 'modifications')
    expect(isChecked(model, BY_TYPE)).toBe(true)
  })

  test('a ready display with no detected types and another field active omits them', () => {
    const model = makeModModel([])
    expect(byLabel(model, BY_TYPE)).toBeFalsy()
    expect(byLabel(model, BISULFITE_LABEL)).toBeTruthy()
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
    expect(labels).not.toContain(BISULFITE_LABEL)
    expect(labels).not.toContain('Tag...')
  })

  test('each section is opted into independently', () => {
    expect(deepLabelsFor({ includePairedEnd: true })).toContain('Paired end')
    expect(deepLabelsFor({ includePairedEnd: true })).not.toContain(
      BISULFITE_LABEL,
    )
    expect(deepLabelsFor({ includeModifications: true })).toContain(
      BISULFITE_LABEL,
    )
    expect(deepLabelsFor({ includeModifications: true })).not.toContain(
      'Paired end',
    )
  })

  test('curated colorOptions replace the basic radios', () => {
    expect(
      labelsFor({ colorOptions: colorFieldOptions(undefined, 'mateRefName') }),
    ).toEqual(['Normal', 'Mate chromosome', 'Solid color...'])
  })

  test('a curated entry can relabel one field for its own display', () => {
    expect(
      labelsFor({
        colorOptions: colorFieldOptions(undefined, {
          field: 'mateRefName',
          label: 'Query name',
        }),
      }),
    ).toEqual(['Normal', 'Query name', 'Solid color...'])
  })

  // The per-base layer draws over the read fill, so Color by... holds two
  // radio groups, each with one row ticked, the second under its sub-header.
  test('per-base coloring is a second radio group under a sub-header', () => {
    const model = makeModel()
    drawing(model, 'modifications')
    const top = subMenuOf(
      getColorByMenuItem(model, { includeModifications: true }),
    )
    const header = top.findIndex(
      i => i.type === 'subHeader' && i.label === 'Per-base coloring',
    )
    const ticked = (items: MenuItem[]) =>
      items.filter(i => 'checked' in i && i.checked).length
    expect(header).toBeGreaterThan(0)
    expect(ticked(top.slice(0, header))).toBe(1)
    expect(ticked(top.slice(header))).toBe(1)
  })

  // Everything behind the field is already wired for a BAM (the worker reads
  // the mate refName off next_ref, readFillColors bakes it, the legend names its
  // empty bucket "No mate"); it just had no row to reach it from.
  test('mate chromosome is reachable from the paired-end submenu', () => {
    const model = makeModel()
    // clickRadio throws if the row isn't there or isn't clickable, so reaching
    // the assertion is itself the "it is offered" half
    clickRadio(model, 'Mate chromosome')
    expect(model.colorField).toBe('mateRefName')
  })
})
