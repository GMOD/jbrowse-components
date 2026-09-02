import { isValidElement } from 'react'

import { resolveSubMenu, staysOpenOnClick } from '@jbrowse/core/ui'

import { pickColorOptions } from '../../shared/colorSchemes.ts'
import { getColorByMenuItem } from './colorBy.ts'

import type { ColorBy } from '../../shared/types.ts'
import type { Pin } from '@jbrowse/core/configuration'
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
// colorBy value — mirrors makePin over the colorBy
// slot.
function fakePinFactory(model: Model) {
  return (colorBy: ColorBy): Pin => {
    const key = JSON.stringify(colorBy)
    return {
      slot: 'colorBy',
      onValue: colorBy,
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
  return item && 'subMenu' in item ? resolveSubMenu(item) : []
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
  return top.flatMap(i => ('subMenu' in i ? [i, ...resolveSubMenu(i)] : [i]))
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
      pin: fakePinFactory(model),
    })
    expect(strand && 'pin' in strand && strand.pin).toBeTruthy()
  })

  test('paired-end radios (First of pair strand) carry a pin', () => {
    const model = makeModel()
    const item = byLabel(model, 'First of pair strand', {
      pin: fakePinFactory(model),
    })
    expect(item && 'pin' in item && item.pin).toBeTruthy()
  })

  test('no standalone "Make ... the default" checkbox remains', () => {
    const model = makeModel()
    const labels = allItems(model, {
      pin: fakePinFactory(model),
    })
      .map(i => ('label' in i ? i.label : ''))
      .filter(Boolean)
    expect(labels.some(l => /Make .* the default/.test(String(l)))).toBe(false)
  })

  test('a scheme pin promotes that exact scheme value', () => {
    const model = makeModel()
    const item = byLabel(model, 'Strand', {
      pin: fakePinFactory(model),
    })
    const pin = item && 'pin' in item ? item.pin : undefined
    if (!pin) {
      throw new Error('no pin on Strand radio')
    }
    pin.control.toggle()
    expect(model.pinned.has(JSON.stringify({ type: 'strand' }))).toBe(true)
  })

  test('no pins when the display is not promotable (synteny omits pin)', () => {
    const model = makeModel()
    const strand = byLabel(model, 'Strand')
    expect(strand && 'pin' in strand && strand.pin).toBeFalsy()
  })

  // The tag radio is the only scheme whose choice carries a parameter, and it
  // was invisible without reopening the dialog.
  test('the tag radio names the tag in use', () => {
    const model = makeModel()
    const labels = (m: Model) =>
      allItems(m, { includeTagOption: true })
        .map(i => ('label' in i ? String(i.label) : ''))
        .filter(l => l.startsWith('Tag'))
    expect(labels(model)).toEqual(['Tag...'])
    model.colorBy = { type: 'tag', tag: 'HP' }
    expect(labels(model)).toEqual(['Tag (HP)...'])
  })

  // A radio row keeps the menu open by its type, which is right for every row
  // that just writes a scheme — users try several, and the menu is an observer so
  // the ticks move live. The tag row is the one exception: its click opens a
  // dialog, so it opts out with keepMenuOpen: false, or the dialog appears behind
  // a menu the user then has to dismiss.
  test('scheme rows stay open, the tag row (a dialog) dismisses', () => {
    const model = makeModel()
    const rows = allItems(model, { includeTagOption: true }).filter(
      i => 'checked' in i,
    )
    expect(rows.length).toBeGreaterThan(1)
    for (const row of rows) {
      const label = 'label' in row ? String(row.label) : ''
      expect([label, staysOpenOnClick(row)]).toEqual([
        label,
        !label.startsWith('Tag'),
      ])
    }
  })

  test('the tag pin promotes the tag actually in use', () => {
    const model = makeModel()
    model.colorBy = { type: 'tag', tag: 'HP' }
    const item = byLabel(model, 'Tag (HP)...', {
      includeTagOption: true,
      pin: fakePinFactory(model),
    })
    const pin = item && 'pin' in item ? item.pin : undefined
    if (!pin) {
      throw new Error('no pin on the tag radio')
    }
    pin.control.toggle()
    expect(model.pinned.has(JSON.stringify({ type: 'tag', tag: 'HP' }))).toBe(
      true,
    )
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
      pin: fakePinFactory(model),
    })
    const pin = item && 'pin' in item ? item.pin : undefined
    if (!pin) {
      throw new Error('no pin on 2-color radio')
    }
    pin.control.toggle()
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
    model.colorBy = { type: 'modifications' }
    expect(byLabel(model, 'Modification types')).toBeFalsy()
  })

  // patchMods is the single writer and always writes type:'modifications', so a
  // refinement reachable from another scheme would switch the scheme and rebuild
  // it from {} — silently discarding the bisulfite selection one row below.
  test.each([
    'Modification types',
    'Probability threshold',
    'Cytosine context',
  ])('%s is revealed only while the modifications scheme is active', label => {
    const model = makeModModel(['m', 'h'])
    model.colorBy = { type: 'bisulfite' }
    expect(byLabel(model, label)).toBeFalsy()

    model.colorBy = { type: 'modifications' }
    expect(byLabel(model, label)).toBeTruthy()
  })

  // The threshold is the shared makeSizeMenu row, so assert through its props.
  test('the threshold slider commits a non-default value inline, and resets', () => {
    const model = makeModModel(['m', 'h'])
    model.colorBy = { type: 'modifications' }
    const item = subMenuOf(byLabel(model, 'Probability threshold')).find(
      i => 'render' in i,
    )
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
    const { onChange, onReset, isDefault, commitOnRelease } =
      rendered.props as {
        onChange: (v: number) => void
        onReset: () => void
        isDefault: boolean
        commitOnRelease: boolean
      }
    expect(isDefault).toBe(true)
    expect(commitOnRelease).toBe(true)
    onChange(80)
    expect(model.colorBy).toEqual({
      type: 'modifications',
      modifications: { threshold: 80 },
    })
    // Resetting writes the default, which patchMods drops so a saved session
    // carries no redundant threshold.
    onReset()
    expect(model.colorBy).toEqual({ type: 'modifications', modifications: {} })
  })

  test('cytosine context is shown only for cytosine methylation data', () => {
    const cytosine = makeModModel(['m', 'h'])
    cytosine.colorBy = { type: 'modifications' }
    expect(byLabel(cytosine, 'Cytosine context')).toBeTruthy()

    const other = makeModModel(['a'])
    other.colorBy = { type: 'modifications' }
    expect(byLabel(other, 'Cytosine context')).toBeFalsy()
  })

  // Detection is per-fetch volatile state, so a track colored by modifications
  // can land on a region whose reads carry no MM/ML calls. Dropping the submenu
  // then left the whole Color by... menu with nothing checked.
  test('the submenu stays while it is the active scheme, with nothing detected', () => {
    const model = makeModModel([])
    model.colorBy = { type: 'modifications' }
    expect(byLabel(model, BY_TYPE)).toBeTruthy()
    expect(allItems(model).some(i => 'checked' in i && i.checked)).toBe(true)
  })

  test('a ready display with no detected types and another scheme active omits it', () => {
    const model = makeModModel([])
    model.colorBy = { type: 'normal' }
    expect(byLabel(model, BY_TYPE)).toBeFalsy()
    expect(byLabel(model, 'Bisulfite / EM-seq')).toBeTruthy()
  })
})

// A display that composes the alignments state model (LGVSyntenyDisplay does)
// carries every modification field, so the menu cannot infer from the model's
// shape that pairs/modifications are meaningless for it — the caller says so.
// Both rows are read only by `readColorCategory`'s chain branches, so outside
// chain mode they are settings that change nothing. Greyed out rather than
// hidden, matching the read-connection band options.
describe('supplementary / split read coloring', () => {
  const supp = (isChainMode: boolean) => ({
    isChainMode,
    flipStrandLongReadChains: true,
    setFlipStrandLongReadChains: () => {},
    colorSupplementaryChains: false,
    setColorSupplementaryChains: () => {},
  })

  test('greys out with chain mode off, naming the switch that enables it', () => {
    const item = byLabel(makeModel(), 'Supplementary / split reads', {
      supplementaryColoring: supp(false),
    })
    expect(item && 'disabled' in item && item.disabled).toBe(true)
    expect(
      item && 'disabledHelpText' in item ? item.disabledHelpText : undefined,
    ).toMatch(/View as pairs/)
  })

  test('live in chain mode, and both rows say which reads they reach', () => {
    const model = makeModel()
    const item = byLabel(model, 'Supplementary / split reads', {
      supplementaryColoring: supp(true),
    })
    expect(item && 'disabled' in item && item.disabled).toBe(false)
    const rows = subMenuOf(item)
    expect(rows).toHaveLength(2)
    // the strand flip is long-read only; orange covers both kinds
    expect(rows.map(r => ('helpText' in r ? r.helpText : ''))).toEqual([
      expect.stringContaining('long (unpaired) reads'),
      expect.stringContaining('paired and long reads alike'),
    ])
  })
})

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
    ).toEqual(['Normal', 'Mate chromosome'])
  })

  test('a curated entry can relabel one scheme for its own display', () => {
    expect(
      labelsFor({
        colorOptions: pickColorOptions('normal', {
          type: 'mateRefName',
          label: 'Query name',
        }),
      }),
    ).toEqual(['Normal', 'Query name'])
  })

  // Everything behind the scheme is already wired for a BAM (the worker reads
  // the mate refName off next_ref, readTagColors bakes it, the legend names its
  // empty bucket "No mate"); it just had no row to reach it from.
  test('mate chromosome is reachable from the paired-end submenu', () => {
    const model = makeModel()
    // clickRadio throws if the row isn't there or isn't clickable, so reaching
    // the assertion is itself the "it is offered" half
    clickRadio(model, 'Mate chromosome')
    expect(model.colorBy).toEqual({ type: 'mateRefName' })
  })
})
