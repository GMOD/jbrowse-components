import { isValidElement } from 'react'

import { getColorByMenuItem } from './colorBy.ts'

import type { ColorBy } from '../../shared/types.ts'
import type { SessionDefaultControl } from '@jbrowse/core/configuration'
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
// colorBy value — mirrors makeSlotsValueSessionDefaultControl over the colorBy
// slot.
function sessionDefault(model: Model) {
  return (colorBy: ColorBy): SessionDefaultControl => {
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
      sessionDefault: sessionDefault(model),
    })
    expect(
      strand && 'endAdornment' in strand && strand.endAdornment,
    ).toBeTruthy()
  })

  test('paired-end radios (First of pair strand) carry a pin', () => {
    const model = makeModel()
    const item = byLabel(model, 'First of pair strand', {
      sessionDefault: sessionDefault(model),
    })
    expect(item && 'endAdornment' in item && item.endAdornment).toBeTruthy()
  })

  test('no standalone "Make ... the default" checkbox remains', () => {
    const model = makeModel()
    const labels = allItems(model, { sessionDefault: sessionDefault(model) })
      .map(i => ('label' in i ? i.label : ''))
      .filter(Boolean)
    expect(labels.some(l => /Make .* the default/.test(String(l)))).toBe(false)
  })

  test('a scheme pin promotes that exact scheme value', () => {
    const model = makeModel()
    const item = byLabel(model, 'Strand', {
      sessionDefault: sessionDefault(model),
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

  test('no pins when the display is not promotable (synteny omits sessionDefault)', () => {
    const model = makeModel()
    const strand = byLabel(model, 'Strand')
    expect(
      strand && 'endAdornment' in strand && strand.endAdornment,
    ).toBeFalsy()
  })
})
