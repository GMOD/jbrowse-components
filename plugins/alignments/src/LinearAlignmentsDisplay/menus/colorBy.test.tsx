import { isValidElement } from 'react'

import { getColorByMenuItem } from './colorBy.tsx'

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
    visibleModificationTypes: [] as string[],
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
// nested "Paired end" radios are reachable by label.
function allItems(
  model: Model,
  opts?: Parameters<typeof getColorByMenuItem>[1],
) {
  const top = subMenuOf(getColorByMenuItem(model, opts))
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
  model.visibleModificationTypes = types
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

  test('the per-type filter is surfaced inline and limits to one type', () => {
    const model = makeModModel(['m', 'h'])
    model.colorBy = { type: 'modifications' }
    const item = subMenuOf(byLabel(model, 'Modification types')).find(
      i => 'label' in i && i.label === '5hmC',
    )
    if (!item || !('onClick' in item)) {
      throw new Error('no 5hmC filter radio')
    }
    item.onClick({})
    expect(model.colorBy).toEqual({
      type: 'modifications',
      modifications: { shownModifications: ['h'] },
    })
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
