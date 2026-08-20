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
  // through: a row is its label, its type and its checked state, and nothing
  // that would make it taller than its siblings.
  it('builds rows carrying nothing but label, type and checked', () => {
    const rows = radios(
      makeRadioSubMenu({
        label: 'Mode',
        value: 'a',
        onChange: () => {},
        options: OPTIONS,
      }),
    )
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual([
        'checked',
        'label',
        'onClick',
        'type',
      ])
    }
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
