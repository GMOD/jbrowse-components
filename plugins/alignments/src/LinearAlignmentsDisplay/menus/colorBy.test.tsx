import { isValidElement } from 'react'

import { getColorByMenuItem } from './colorBy.tsx'
import { pickColorOptions } from '../../shared/colorSchemes.ts'

import type { ColorBy } from '../../shared/types.ts'
import type { DisplayTypeDefaultControl } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'

// Minimal model: enough for schemeRadios + the Paired end submenu (modModel is
// "defined" whenever modificationsReady is set, even to false). `pinned` records
// which colorBy values have been promoted as the session default.
function makeModel() {
  return {
    colorBy: { type: 'normal' } as ColorBy,
    setColorScheme(cb: ColorBy) {
      this.colorBy = cb
    },
    pinned: new Set<string>(),
    modificationsReady: false,
    regionTooLarge: false,
    detectedModificationTypes: [] as string[],
    modificationThreshold: 0.5,
  }
}

type Model = ReturnType<typeof makeModel>

// A per-value pin control backed by the model's `pinned` set, keyed on the
// colorBy value — mirrors makeSlotsValueDisplayTypeDefaultControl over the colorBy
// slot.
function displayTypeDefault(model: Model) {
  return (colorBy: ColorBy): DisplayTypeDefaultControl => {
    const key = JSON.stringify(colorBy)
    return {
      active: model.pinned.has(key),
      toggle() {
        if (model.pinned.has(key)) {
          model.pinned.delete(key)
        } else {
          model.pinned.add(key)
        }
      },
    }
  }
}

function subMenuOf(item: MenuItem | undefined) {
  return item && 'subMenu' in item ? item.subMenu : []
}

// Flatten the Color by... menu one level so both top-level scheme radios and the
// nested "Paired end" radios are reachable by label. These specs describe the
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
  return top.flatMap(i => ('subMenu' in i ? [i, ...i.subMenu] : [i]))
}

function byLabel(
  model: Model,
  label: string,
  opts?: Parameters<typeof getColorByMenuItem>[1],
) {
  return allItems(model, opts).find(i => 'label' in i && i.label === label)
}

describe('color by menu', () => {
  test('basic scheme radios carry a session-default pin when promotable', () => {
    const model = makeModel()
    const strand = byLabel(model, 'Strand', {
      displayTypeDefault: displayTypeDefault(model),
    })
    expect(
      strand && 'endAdornment' in strand && strand.endAdornment,
    ).toBeTruthy()
  })

  test('paired-end radios (First of pair strand) carry a pin', () => {
    const model = makeModel()
    const item = byLabel(model, 'First of pair strand', {
      displayTypeDefault: displayTypeDefault(model),
    })
    expect(item && 'endAdornment' in item && item.endAdornment).toBeTruthy()
  })

  test('no standalone "Make ... the default" checkbox remains', () => {
    const model = makeModel()
    const labels = allItems(model, {
      displayTypeDefault: displayTypeDefault(model),
    })
      .map(i => ('label' in i ? i.label : ''))
      .filter(Boolean)
    expect(labels.some(l => /Make .* the default/.test(String(l)))).toBe(false)
  })

  test('a scheme pin promotes that exact scheme value', () => {
    const model = makeModel()
    const item = byLabel(model, 'Strand', {
      displayTypeDefault: displayTypeDefault(model),
    })
    const adornment =
      item && 'endAdornment' in item ? item.endAdornment : undefined
    if (!isValidElement(adornment)) {
      throw new Error('no pin on Strand radio')
    }
    const { control } = adornment.props as { control: { toggle: () => void } }
    control.toggle()
    expect(model.pinned.has(JSON.stringify({ type: 'strand' }))).toBe(true)
  })

  test('no pins when the display is not promotable (synteny omits displayTypeDefault)', () => {
    const model = makeModel()
    const strand = byLabel(model, 'Strand')
    expect(
      strand && 'endAdornment' in strand && strand.endAdornment,
    ).toBeFalsy()
  })
})

// A ready display carrying the given modification types, so the "Color by
// modifications" submenu is built rather than the loading placeholder.
function makeModModel(types = ['m', 'h']) {
  const model = makeModel()
  model.modificationsReady = true
  model.detectedModificationTypes = types
  model.modificationThreshold = 10
  return model
}

function clickRadio(model: Model, label: string) {
  const item = byLabel(model, label)
  if (!item || !('onClick' in item)) {
    throw new Error(`no clickable "${label}"`)
  }
  item.onClick({})
}

const BY_TYPE = 'One color per modification type'
const TWO_COLOR =
  'One color per type, plus low-probability & unmodified in blue'

describe('color by modifications menu', () => {
  const controls = [BY_TYPE, TWO_COLOR, 'Probability threshold']

  test.each([
    ['by type', { type: 'modifications' }],
    ['2-color', { type: 'modifications', modifications: { twoColor: true } }],
    ['fill', { type: 'modifications', modifications: { fillUnmarked: true } }],
  ] as [string, ColorBy][])(
    'shows the same controls regardless of the active view (%s)',
    (_name, colorBy) => {
      const model = makeModModel()
      model.colorBy = colorBy
      for (const label of controls) {
        expect(byLabel(model, label)).toBeTruthy()
      }
    },
  )

  test('the Probability view fills unmarked cytosines for methylation data', () => {
    const model = makeModModel(['m', 'h'])
    model.colorBy = { type: 'modifications' }
    clickRadio(model, TWO_COLOR)
    expect(model.colorBy).toEqual({
      type: 'modifications',
      modifications: { fillUnmarked: true },
    })
  })

  test('the Probability view is plain two-color for non-cytosine modifications', () => {
    const model = makeModModel(['a'])
    model.colorBy = { type: 'modifications' }
    clickRadio(model, TWO_COLOR)
    expect(model.colorBy).toEqual({
      type: 'modifications',
      modifications: { twoColor: true },
    })
  })

  test('the fill view reads as the "2-color" radio, not a separate row', () => {
    const model = makeModModel()
    model.colorBy = {
      type: 'modifications',
      modifications: { fillUnmarked: true },
    }
    const prob = byLabel(model, TWO_COLOR)
    expect(prob && 'checked' in prob && prob.checked).toBe(true)
  })

  test('switching views preserves refinements (cytosine context)', () => {
    const model = makeModModel()
    model.colorBy = {
      type: 'modifications',
      modifications: { fillUnmarked: true, cytosineContext: 'CHH' },
    }
    clickRadio(model, BY_TYPE)
    expect(model.colorBy).toEqual({
      type: 'modifications',
      modifications: { cytosineContext: 'CHH' },
    })
  })

  test('the 2-color pin promotes the methylation view for cytosine data', () => {
    const model = makeModModel(['m', 'h'])
    const item = byLabel(model, TWO_COLOR, {
      displayTypeDefault: displayTypeDefault(model),
    })
    const adornment =
      item && 'endAdornment' in item ? item.endAdornment : undefined
    if (!isValidElement(adornment)) {
      throw new Error('no pin on 2-color radio')
    }
    const { control } = adornment.props as { control: { toggle: () => void } }
    control.toggle()
    expect(
      model.pinned.has(
        JSON.stringify({
          type: 'modifications',
          modifications: { fillUnmarked: true },
        }),
      ),
    ).toBe(true)
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
    model.colorBy = { type: 'modifications' }
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
    model.colorBy = { type: 'modifications' }
    tickModType(model, '5hmC')
    expect(model.colorBy).toEqual({
      type: 'modifications',
      modifications: { shownModifications: ['m', 'a'] },
    })
  })

  test('types are independent — two can be unticked, unlike the old radio', () => {
    const model = makeModModel(['m', 'h', 'a'])
    model.colorBy = { type: 'modifications' }
    tickModType(model, '5hmC')
    tickModType(model, '6mA')
    expect(model.colorBy).toEqual({
      type: 'modifications',
      modifications: { shownModifications: ['m'] },
    })
  })

  test('re-ticking every type stores nothing, so types found later stay visible', () => {
    const model = makeModModel(['m', 'h'])
    model.colorBy = {
      type: 'modifications',
      modifications: { shownModifications: ['m'] },
    }
    tickModType(model, '5hmC')
    expect(model.colorBy).toEqual({ type: 'modifications', modifications: {} })
  })

  test('unticking the last type draws no marks rather than silently drawing all', () => {
    const model = makeModModel(['m', 'h'])
    model.colorBy = {
      type: 'modifications',
      modifications: { shownModifications: ['m'] },
    }
    tickModType(model, '5mC')
    expect(model.colorBy).toEqual({
      type: 'modifications',
      modifications: { shownModifications: [] },
    })
  })

  test('a hiddenModifications config reads back as unticked, and ticking clears it', () => {
    const model = makeModModel(['m', 'h'])
    model.colorBy = {
      type: 'modifications',
      modifications: { hiddenModifications: ['h'] },
    }
    expect(
      subMenuOf(byLabel(model, 'Modification types')).map(i =>
        'checked' in i ? i.checked : undefined,
      ),
    ).toEqual([true, false])
    tickModType(model, '5hmC')
    expect(model.colorBy).toEqual({ type: 'modifications', modifications: {} })
  })

  test('the per-type filter is hidden when only one type is detected', () => {
    const model = makeModModel(['m'])
    expect(byLabel(model, 'Modification types')).toBeFalsy()
  })

  test('the threshold slider commits a non-default value inline', () => {
    const model = makeModModel(['m', 'h'])
    model.colorBy = { type: 'modifications' }
    const item = subMenuOf(byLabel(model, 'Probability threshold')).find(
      i => 'render' in i,
    )
    if (!item || !('render' in item)) {
      throw new Error('no threshold slider')
    }
    const rendered = item.render(() => {})
    if (!isValidElement(rendered)) {
      throw new Error('threshold slider did not render')
    }
    const { onCommit } = rendered.props as { onCommit: (v: number) => void }
    onCommit(80)
    expect(model.colorBy).toEqual({
      type: 'modifications',
      modifications: { threshold: 80 },
    })
  })

  test('cytosine context is shown only for cytosine methylation data', () => {
    expect(byLabel(makeModModel(['m', 'h']), 'Cytosine context')).toBeTruthy()
    expect(byLabel(makeModModel(['a']), 'Cytosine context')).toBeFalsy()
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

  test('paired-end and modification sections are absent unless opted into', () => {
    const labels = labelsFor({})
    expect(labels).not.toContain('Paired end')
    expect(labels).not.toContain('Bisulfite / EM-seq')
    expect(labels).not.toContain('Tag...')
  })

  test('each section is opted into independently', () => {
    expect(labelsFor({ includePairedEnd: true })).toContain('Paired end')
    expect(labelsFor({ includePairedEnd: true })).not.toContain(
      'Bisulfite / EM-seq',
    )
    expect(labelsFor({ includeModifications: true })).toContain(
      'Bisulfite / EM-seq',
    )
    expect(labelsFor({ includeModifications: true })).not.toContain(
      'Paired end',
    )
  })

  test('curated colorOptions replace the basic radios', () => {
    expect(
      labelsFor({ colorOptions: pickColorOptions('normal', 'mateRefName') }),
    ).toEqual(['Normal', 'Query name'])
  })
})
