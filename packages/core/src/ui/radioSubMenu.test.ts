import { makeRadioSubMenu } from './radioSubMenu.ts'

import type { RadioMenuItem } from './MenuTypes.ts'

const OPTIONS = [
  ['a', 'Option A'],
  ['b', 'Option B'],
] as const

function radios(item: ReturnType<typeof makeRadioSubMenu>) {
  return ('subMenu' in item ? item.subMenu : []) as RadioMenuItem[]
}

describe('makeRadioSubMenu', () => {
  it('ticks the current value and calls back with the picked one', () => {
    const picked: string[] = []
    const rows = radios(
      makeRadioSubMenu({
        label: 'Mode',
        value: 'b',
        onChange: v => {
          picked.push(v)
        },
        options: OPTIONS,
      }),
    )
    expect(rows.map(r => [r.label, r.checked])).toEqual([
      ['Option A', false],
      ['Option B', true],
    ])
    rows[0]!.onClick()
    expect(picked).toEqual(['a'])
  })

  // `radioItems` has carried `subLabel` all along and this builder simply
  // dropped it, so a caller wanting to say why an option is currently inert had
  // to hand-roll the whole submenu — and lose the keep-menu-open behaviour that
  // going through `radioItems` is what buys.
  it('passes per-option subLabels through', () => {
    const rows = radios(
      makeRadioSubMenu({
        label: 'Mode',
        value: 'a',
        onChange: () => {},
        options: OPTIONS,
        subLabels: { b: 'zoom in to see it' },
      }),
    )
    expect(rows.map(r => r.subLabel)).toEqual([undefined, 'zoom in to see it'])
  })

  // The reason an option is inert moves with zoom and with sibling settings, so
  // it is normal for the map to be absent or to name nothing this time round.
  it('leaves every row bare when none is given', () => {
    const rows = radios(
      makeRadioSubMenu({
        label: 'Mode',
        value: 'a',
        onChange: () => {},
        options: OPTIONS,
      }),
    )
    expect(rows.map(r => r.subLabel)).toEqual([undefined, undefined])
  })

  it('appends extraItems after the radios', () => {
    const item = makeRadioSubMenu({
      label: 'Mode',
      value: 'a',
      onChange: () => {},
      options: OPTIONS,
      extraItems: [{ label: 'Something else', onClick: () => {} }],
    })
    const last = ('subMenu' in item ? item.subMenu : []).at(-1)
    expect(last && 'label' in last ? last.label : undefined).toBe(
      'Something else',
    )
  })
})
