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

  // A caller saying why an option is currently inert puts that in the option's
  // own label (`withHint`), so this builder has no per-row decoration to pass
  // through and its rows carry nothing but what the options table names.
  it('leaves every row bare', () => {
    const rows = radios(
      makeRadioSubMenu({
        label: 'Mode',
        value: 'a',
        onChange: () => {},
        options: OPTIONS,
      }),
    )
    expect(rows.map(r => 'subLabel' in r && r.subLabel)).toEqual([false, false])
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
