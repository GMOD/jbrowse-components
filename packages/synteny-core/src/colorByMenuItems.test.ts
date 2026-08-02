import { colorByMenuItems } from './colorByMenuItems.tsx'

import type {
  ColorByMenuTarget,
  ColorByMenuTrack,
} from './colorByMenuItems.tsx'
import type { MenuItem } from '@jbrowse/core/ui'

const track = (n: number, over: Partial<ColorByMenuTrack> = {}) =>
  ({
    trackId: `t${n}`,
    name: `track ${n}`,
    colorBy: 'default',
    trackColor: '#4e79a7',
    pinned: false,
    overridden: false,
    ...over,
  }) satisfies ColorByMenuTrack

const noop = () => {}

const target = (over: Partial<ColorByMenuTarget> = {}): ColorByMenuTarget => ({
  uniformColorBy: 'default',
  tracks: [track(0), track(1)],
  pointBased: false,
  showReference: false,
  showColorLegend: false,
  setColorBy: noop,
  setTrackColorBy: noop,
  setTrackColor: noop,
  clearTrackColorSettings: noop,
  setShowColorLegend: noop,
  ...over,
})

const labels = (items: ReturnType<typeof colorByMenuItems>) =>
  items.map(i => ('label' in i ? i.label : `<${i.type}>`))

function findSubMenu(
  items: ReturnType<typeof colorByMenuItems>,
  label: string,
) {
  const found = items.find(i => 'label' in i && i.label === label)
  return found && 'subMenu' in found ? found.subMenu : undefined
}

// The view-wide radios come first and are the primary control; per-track is a
// secondary override below them. Locking the order in keeps that hierarchy from
// inverting under a later edit.
test('view-wide modes lead, per-track follows as an override section', () => {
  const items = colorByMenuItems(target())
  const got = labels(items)
  expect(got.slice(0, 3)).toEqual([
    'Default',
    'Strand',
    'Distinct color per track',
  ])
  expect(got.indexOf('Customize per track')).toBeGreaterThan(
    got.indexOf('Distinct color per track'),
  )
  expect(got.at(-1)).toBe('Show color legend')
})

test('a single track gets no per-track section and no Track mode', () => {
  const got = labels(colorByMenuItems(target({ tracks: [track(0)] })))
  expect(got).not.toContain('Customize per track')
  // one track has nothing to be told apart from
  expect(got).not.toContain('Distinct color per track')
})

test("'Reference' only appears for a stack of two or more levels", () => {
  expect(labels(colorByMenuItems(target()))).not.toContain('Reference')
  expect(labels(colorByMenuItems(target({ showReference: true })))).toContain(
    'Reference',
  )
})

test('the dotplot gets point-based help text for Default', () => {
  const ribbon = colorByMenuItems(target())[0]!
  const dotplot = colorByMenuItems(target({ pointBased: true }))[0]!
  expect('helpText' in ribbon && ribbon.helpText).toContain('red')
  expect('helpText' in dotplot && dotplot.helpText).toContain('black')
})

test('each track submenu offers "Use view setting" plus the same modes', () => {
  const items = colorByMenuItems(target())
  const perTrack = findSubMenu(items, 'Customize per track')!
  expect(perTrack.map(i => ('label' in i ? i.label : ''))).toEqual([
    'track 0',
    'track 1',
  ])
  const first = findSubMenu(perTrack, 'track 0')!
  const inner = first.map(i => ('label' in i ? i.label : `<${i.type}>`))
  expect(inner[0]).toBe('Use view setting')
  expect(inner).toContain('Strand')
  expect(inner.at(-1)).toBe('Reset color to automatic')
})

test('reset rows are disabled until something is actually overridden', () => {
  const clean = colorByMenuItems(target())
  const reset = clean.find(
    i => 'label' in i && i.label === 'Reset per-track colors',
  )
  expect(reset && 'disabled' in reset && reset.disabled).toBe(true)

  const dirty = colorByMenuItems(
    target({ tracks: [track(0, { pinned: true }), track(1)] }),
  )
  const resetDirty = dirty.find(
    i => 'label' in i && i.label === 'Reset per-track colors',
  )
  expect(resetDirty && 'disabled' in resetDirty && resetDirty.disabled).toBe(
    false,
  )
})

test('mixed modes leave every view-wide radio unchecked', () => {
  const items = colorByMenuItems(target({ uniformColorBy: undefined }))
  const radios = items.filter(i => 'type' in i && i.type === 'radio')
  expect(radios.length).toBeGreaterThan(0)
  expect(radios.every(r => 'checked' in r && !r.checked)).toBe(true)
})

// Regression: "Use view setting" used to be checked whenever the track's
// RESOLVED mode equalled the view's, so a track explicitly pinned to the same
// mode the view already used showed two checked radios, and clicking "Use view
// setting" cleared the override with nothing visibly changing. Checked state
// has to follow whether an override EXISTS, not what it resolves to.
describe('per-track "Use view setting"', () => {
  const submenuFor = (t: ColorByMenuTarget, name: string) => {
    const items = colorByMenuItems(t)
    const perTrack = items.find(
      i => 'label' in i && i.label === 'Customize per track',
    )
    const list = perTrack && 'subMenu' in perTrack ? perTrack.subMenu : []
    const row = list.find(i => 'label' in i && i.label === name)
    return row && 'subMenu' in row ? row.subMenu : []
  }
  const checkedOf = (items: MenuItem[], label: string) => {
    const row = items.find(i => 'label' in i && i.label === label)
    return row && 'checked' in row ? row.checked : undefined
  }

  test('an override equal to the view mode still reads as an override', () => {
    const sub = submenuFor(
      target({
        uniformColorBy: 'strand',
        tracks: [
          track(0, { colorBy: 'strand', overridden: true }),
          track(1, { colorBy: 'strand' }),
        ],
      }),
      'track 0',
    )
    expect(checkedOf(sub, 'Use view setting')).toBe(false)
    expect(checkedOf(sub, 'Strand')).toBe(true)
  })

  test('exactly one radio is checked in a track submenu', () => {
    for (const t of [
      target(),
      target({
        tracks: [track(0, { colorBy: 'strand', overridden: true }), track(1)],
      }),
      target({
        uniformColorBy: 'strand',
        tracks: [
          track(0, { colorBy: 'strand', overridden: true }),
          track(1, { colorBy: 'strand' }),
        ],
      }),
    ]) {
      const sub = submenuFor(t, 'track 0')
      const checked = sub.filter(i => 'checked' in i && i.checked)
      expect(checked).toHaveLength(1)
    }
  })

  test('clearing an override rechecks "Use view setting"', () => {
    const overrides = new Map<string, string>([['t0', 'strand']])
    const build = () =>
      target({
        uniformColorBy: overrides.size ? undefined : 'default',
        tracks: [
          track(0, {
            colorBy: (overrides.get('t0') ?? 'default') as 'strand' | 'default',
            overridden: overrides.has('t0'),
          }),
          track(1),
        ],
        setTrackColorBy: (id, value) => {
          if (value === undefined) {
            overrides.delete(id)
          } else {
            overrides.set(id, value)
          }
        },
      })

    expect(checkedOf(submenuFor(build(), 'track 0'), 'Use view setting')).toBe(
      false,
    )
    const row = submenuFor(build(), 'track 0').find(
      i => 'label' in i && i.label === 'Use view setting',
    )!
    ;(row as { onClick: () => void }).onClick()
    expect(overrides.has('t0')).toBe(false)
    expect(checkedOf(submenuFor(build(), 'track 0'), 'Use view setting')).toBe(
      true,
    )
  })
})
