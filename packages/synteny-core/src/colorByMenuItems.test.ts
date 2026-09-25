import { resolveSubMenu } from '@jbrowse/core/ui/menuItems'

import { colorByMenuItems } from './colorByMenuItems.tsx'
import { colorByMenuTargetFor } from './colorByMenuTarget.ts'
import { VALUE_MODES_LABEL } from './colorModes.ts'

import type {
  ColorByMenuTarget,
  ColorByMenuTrack,
  TrackColorsModel,
} from './colorByMenuTarget.ts'

const track = (n: number, over: Partial<ColorByMenuTrack> = {}) =>
  ({
    trackId: `t${n}`,
    name: `track ${n}`,
    trackColor: '#4e79a7',
    pinned: false,
    ...over,
  }) satisfies ColorByMenuTrack

const noop = () => {}

const trackColors = (tracks: ColorByMenuTrack[]) => ({
  tracks,
  setTrackColor: noop,
  clearTrackColors: noop,
})

const target = (over: Partial<ColorByMenuTarget> = {}): ColorByMenuTarget => ({
  field: '',
  structuralFields: ['', 'strand', 'track', 'query', 'target'],
  attributes: [],
  attributeRanges: {
    identity: { min: 0.5, max: 1 },
    mappingQual: { min: 0, max: 60 },
    dnds: { min: 0, max: 2 },
  },
  surface: 'ribbons',
  hideUnlabelled: false,
  colorDomain: [],
  setHideUnlabelled: noop,
  setColorField: noop,
  setColorDomain: noop,
  trackColors: trackColors([track(0), track(1)]),
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

test('a surface lists the structural modes it paints, and one track has no swatches', () => {
  const got = labels(
    colorByMenuItems(
      target({
        structuralFields: ['', 'strand'],
        trackColors: trackColors([track(0)]),
      }),
    ),
  )
  expect(got).toEqual(['Default', 'Strand', VALUE_MODES_LABEL])
})

function viewModel(tracks: number, reference = false): TrackColorsModel {
  return {
    colorableTracks: Array.from({ length: tracks }, (_, i) => ({
      trackId: `t${i}`,
      name: `track ${i}`,
    })),
    colorableAttributes: [],
    attributeRanges: {},
    colorField: '',
    hideUnlabelled: false,
    colorDomain: [],
    trackColorFor: () => '#4e79a7',
    colorSurface: () => 'ribbons',
    offersReferenceColor: () => reference,
    setColorField: noop,
    setHideUnlabelled: noop,
    setColorDomain: noop,
    setTrackColor: noop,
    clearTrackColors: noop,
  }
}

// One track has nothing to be told apart from, and 'reference' is meaningless
// below two stacked levels
test('a view offers Track once two tracks overlay, and Reference across a stack', () => {
  const modesOf = (tracks: number, reference: boolean) =>
    colorByMenuTargetFor(viewModel(tracks, reference)).structuralFields
  expect(modesOf(1, false)).toEqual(['', 'strand', 'query', 'target'])
  expect(modesOf(2, true)).toEqual([
    '',
    'strand',
    'track',
    'query',
    'target',
    'reference',
  ])
})

test('each surface gets its own help text where the mode reads differently there', () => {
  const helpOf = (surface: ColorByMenuTarget['surface'], index: number) => {
    const item = colorByMenuItems(target({ surface }))[index]!
    return 'helpText' in item ? item.helpText : undefined
  }
  expect(helpOf('ribbons', 0)).toContain('red')
  expect(helpOf('points', 0)).toContain('black')
  expect(helpOf('lanes', 0)).toContain("track's ribbon color")
  expect(helpOf('lanes', 1)).toContain('lane above')
  expect(helpOf('points', 1)).toBe(helpOf('ribbons', 1))
})

// Under a text column the labels seen so far can be pinned, so each keeps its
// palette slot; a label already in the domain keeps its place.
test('a text column offers its unlabelled toggle and a pin for the labels not yet pinned', () => {
  const written: string[][] = []
  const categorical = (colorDomain: string[]) =>
    colorByMenuItems(
      target({
        field: 'group',
        attributeRanges: {
          group: { labels: ['B1', 'A1a', 'C1'], colors: {} },
        },
        colorDomain,
        setColorDomain: domain => {
          written.push(domain)
        },
        trackColors: undefined,
      }),
    )
  const rows = categorical(['A1a'])
  expect(labels(rows).slice(-2)).toEqual([
    'Hide unlabelled rows',
    'Pin distinct colors',
  ])
  const pin = rows.at(-1)!
  expect('disabled' in pin && pin.disabled).toBe(false)
  ;(pin as { onClick: () => void }).onClick()
  expect(written).toEqual([['A1a', 'B1', 'C1']])

  const pinned = categorical(['C1', 'B1', 'A1a']).at(-1)!
  expect('disabled' in pinned && pinned.disabled).toBe(true)
  expect(labels(colorByMenuItems(target()))).not.toContain(
    'Pin distinct colors',
  )
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
  const active = labels(colorByMenuItems(target({ field: 'dnds' })))
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

test('the mapq field is offered once the adapters carry mappingQual', () => {
  const setColorField = jest.fn()
  const rows = valueModes(
    colorByMenuItems(
      target({
        attributeRanges: { mappingQual: { min: 0, max: 60 } },
        setColorField,
      }),
    ),
  )
  const mapq = rows.find(r => 'label' in r && r.label === 'Mapping quality')!
  expect('disabled' in mapq && mapq.disabled).toBe(false)
  ;(mapq as { onClick: () => void }).onClick()
  expect(setColorField).toHaveBeenCalledWith('mapq')
})

test('each track row carries its swatch and a way back to automatic', () => {
  const colors = findSubMenu(colorByMenuItems(target()), 'Track colors')!
  expect(labels(colors)).toEqual([
    'track 0',
    'track 1',
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
      target({
        trackColors: trackColors([track(0, { pinned: true }), track(1)]),
      }),
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
      setColorField: value => {
        picked.push(value)
      },
    }),
  )
  const values = valueModes(items)
  expect(labels(values)).toContain('dn')
  expect(labels(values)).toContain('goc_score')
  const goc = values.find(i => 'label' in i && i.label === 'goc_score')!
  ;(goc as { onClick: () => void }).onClick()
  expect(picked).toEqual(['goc_score'])
})

// A column an aligner named after a preset or a structural field writes the
// same field those radios do, so a second radio for it would check alongside
// the first and lead somewhere it does not go.
test('a column a radio already covers is not offered twice', () => {
  const items = colorByMenuItems(
    target({
      attributes: ['identity', 'strand', 'goc_score'],
      structuralFields: ['', 'strand'],
    }),
  )
  expect(labels(valueModes(items))).not.toContain('identity')
  expect(labels(valueModes(items))).not.toContain('strand')
  expect(labels(items).filter(l => l === 'Strand')).toHaveLength(1)
  expect(labels(valueModes(items))).toContain('goc_score')
})

// An attribute mode has to show as checked the same as a preset — the mode is
// one string either way, which is the point of encoding it in the string.
test('an attribute mode checks like a preset', () => {
  const items = colorByMenuItems(
    target({
      attributes: ['dn'],
      field: 'dn',
    }),
  )
  const dn = valueModes(items).find(i => 'label' in i && i.label === 'dn')!
  expect((dn as { checked: boolean }).checked).toBe(true)
  expect(labels(items)).toContain(`${VALUE_MODES_LABEL} — dn`)
})
