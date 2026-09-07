import { resolveSubMenu } from '@jbrowse/core/ui/menuItems'

import { colorByMenuItems } from './colorByMenuItems.tsx'
import { VALUE_MODES_LABEL } from './colorModes.ts'

import type {
  ColorByMenuTarget,
  ColorByMenuTrack,
} from './colorByMenuItems.tsx'

const track = (n: number, over: Partial<ColorByMenuTrack> = {}) =>
  ({
    trackId: `t${n}`,
    name: `track ${n}`,
    trackColor: '#4e79a7',
    pinned: false,
    ...over,
  }) satisfies ColorByMenuTrack

const noop = () => {}

const target = (over: Partial<ColorByMenuTarget> = {}): ColorByMenuTarget => ({
  colorBy: 'default',
  tracks: [track(0), track(1)],
  attributes: [],
  attributeRanges: {
    identity: { min: 0.5, max: 1 },
    mappingQual: { min: 0, max: 60 },
    dnds: { min: 0, max: 2 },
  },
  pointBased: false,
  showReference: false,
  categorical: false,
  hideUnlabelled: false,
  setHideUnlabelled: noop,
  setColorBy: noop,
  setTrackColor: noop,
  clearTrackColors: noop,
  ...over,
})

const labels = (items: ReturnType<typeof colorByMenuItems>) =>
  items.map(i => ('label' in i ? i.label : `<${i.type}>`))

function findSubMenu(
  items: ReturnType<typeof colorByMenuItems>,
  label: string,
) {
  const found = items.find(
    i =>
      'label' in i && typeof i.label === 'string' && i.label.startsWith(label),
  )
  return found && 'subMenu' in found ? resolveSubMenu(found) : undefined
}

const valueModes = (items: ReturnType<typeof colorByMenuItems>) =>
  findSubMenu(items, VALUE_MODES_LABEL)!

// The view-wide radios come first and are the primary control; the per-track
// swatches are a secondary section below them. Locking the order in keeps that
// hierarchy from inverting under a later edit.
test('view-wide modes lead, track colors follow', () => {
  const got = labels(colorByMenuItems(target()))
  expect(got.slice(0, 3)).toEqual([
    'Default',
    'Strand',
    'Distinct color per track',
  ])
  expect(got.indexOf('Track colors')).toBeGreaterThan(
    got.indexOf(VALUE_MODES_LABEL),
  )
  expect(got.at(-1)).toBe('Track colors')
})

test('a single track gets no track colors section and no Track mode', () => {
  const got = labels(colorByMenuItems(target({ tracks: [track(0)] })))
  expect(got).not.toContain('Track colors')
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

// The measurements sit one hop in, so a plain PAF's user meets five radios
// rather than ten, and the row that opens them names the one in use.
test('value modes live in one submenu whose row names the active one', () => {
  const top = labels(colorByMenuItems(target()))
  expect(top).not.toContain('Identity')
  expect(top).not.toContain('dN/dS')
  expect(top).toContain(VALUE_MODES_LABEL)
  expect(labels(valueModes(colorByMenuItems(target())))).toEqual([
    'Identity',
    'Mapping quality',
    'dN/dS',
  ])
  const active = labels(colorByMenuItems(target({ colorBy: 'dnds' })))
  expect(active).toContain(`${VALUE_MODES_LABEL} — dN/dS`)
})

// A measurement the loaded alignments never carried is a row that paints every
// ribbon the missing-data color, so it is offered disabled with the reason.
test('a value mode is disabled until the data has carried it', () => {
  const rows = valueModes(
    colorByMenuItems(
      target({ attributeRanges: { identity: { min: 0, max: 1 } } }),
    ),
  )
  const state = Object.fromEntries(
    rows.map(r => ['label' in r ? r.label : '', 'disabled' in r && r.disabled]),
  )
  expect(state).toEqual({
    Identity: false,
    'Mapping quality': true,
    'dN/dS': true,
  })
  const dnds = rows.find(r => 'label' in r && r.label === 'dN/dS')!
  expect('disabledHelpText' in dnds && dnds.disabledHelpText).toBe(
    'The loaded alignments carry no dN/dS',
  )
})

test('each track row carries its swatch and a way back to automatic', () => {
  const colors = findSubMenu(colorByMenuItems(target()), 'Track colors')!
  expect(labels(colors)).toEqual([
    'track 0',
    'track 1',
    '<divider>',
    'Reset all to automatic',
  ])
  const first = colors[0]!
  expect('endAdornment' in first && first.endAdornment).toBeTruthy()
  const reset = findSubMenu(colors, 'track 0')![0]!
  expect('label' in reset && reset.label).toBe('Reset color to automatic')
  expect('disabled' in reset && reset.disabled).toBe(true)
})

test('reset rows are disabled until a color is actually pinned', () => {
  const clean = findSubMenu(colorByMenuItems(target()), 'Track colors')!
  const reset = clean.at(-1)!
  expect('disabled' in reset && reset.disabled).toBe(true)

  const dirty = findSubMenu(
    colorByMenuItems(
      target({ tracks: [track(0, { pinned: true }), track(1)] }),
    ),
    'Track colors',
  )!
  const resetAll = dirty.at(-1)!
  expect('disabled' in resetAll && resetAll.disabled).toBe(false)
})

// The declared columns appear as modes of their own, which is what keeps the
// named list above from gaining a member per measurement anyone wants to see.
test('a declared numeric column is offered as its own mode', () => {
  const picked: string[] = []
  const items = colorByMenuItems(
    target({
      attributes: ['dn', 'goc_score'],
      setColorBy: value => {
        picked.push(value)
      },
    }),
  )
  const values = valueModes(items)
  expect(labels(values)).toContain('dn')
  expect(labels(values)).toContain('goc_score')
  const goc = values.find(i => 'label' in i && i.label === 'goc_score')!
  ;(goc as { onClick: () => void }).onClick()
  expect(picked).toEqual(['attribute:goc_score'])
})

// An attribute mode has to show as checked the same as a preset — the mode is
// one string either way, which is the point of encoding it in the string.
test('an attribute mode checks like a preset', () => {
  const items = colorByMenuItems(
    target({
      attributes: ['dn'],
      colorBy: 'attribute:dn',
    }),
  )
  const dn = valueModes(items).find(i => 'label' in i && i.label === 'dn')!
  expect((dn as { checked: boolean }).checked).toBe(true)
  expect(labels(items)).toContain(`${VALUE_MODES_LABEL} — dn`)
})
