import { connectedVariantJunctions } from './connectedJunctions.ts'
import {
  drawnConnectionKey,
  drawnConnectionKeySections,
} from './overlayUtils.tsx'

import type { BreakpointViewModel } from '../model.ts'
import type { JBrowsePalette } from '@jbrowse/core/ui/palette'

jest.mock('./connectedJunctions.ts', () => ({
  connectedVariantJunctions: jest.fn(() => []),
}))

const theme = { mode: 'light' } as JBrowsePalette
const RED = '#ff0000'
const BLUE = '#0000ff'

function fakeModel({
  tooLarge = new Set<string>(),
  drawn = new Map<string, { kind: string; color: string; label: string }[]>(),
}) {
  return {
    views: [],
    assemblies: [],
    overlayMatches: new Map([
      ['reads', { kind: 'alignment' }],
      ['calls', { kind: 'variant' }],
    ]),
    getMatchedTracks: (trackId: string) => [
      { displays: [{ regionTooLarge: tooLarge.has(trackId) }] },
    ],
    drawnConnectionsByTrack: drawn,
    connectionStylerIn:
      () =>
      ({ color, label }: { color: string; label: string }) => ({
        color,
        label,
      }),
  } as unknown as BreakpointViewModel
}

const drawn = new Map([
  [
    'reads',
    [
      { kind: 'splitInverted', color: BLUE, label: 'Split alignment' },
      { kind: 'readPair', color: RED, label: 'Read pair' },
      { kind: 'pairLR', color: RED, label: 'LR' },
    ],
  ],
])

afterEach(() => {
  jest.mocked(connectedVariantJunctions).mockReturnValue([])
})

test('reads alone make one section, with no heading row', () => {
  const model = fakeModel({ drawn })
  const sections = drawnConnectionKeySections(model, theme, ['reads'])
  expect(sections.map(s => s.title)).toEqual(['Reads'])
  expect(sections[0]!.rows.map(r => r.label)).toEqual([
    'Read pair / LR',
    'Split alignment',
  ])
  expect(drawnConnectionKey(model, theme, ['reads']).map(r => r.label)).toEqual(
    ['Read pair / LR', 'Split alignment'],
  )
})

test('a drawn call puts Calls before Reads, each under a heading', () => {
  jest
    .mocked(connectedVariantJunctions)
    .mockImplementation(({ match }) =>
      match.kind === 'variant'
        ? ([{}] as ReturnType<typeof connectedVariantJunctions>)
        : [],
    )
  const model = fakeModel({ drawn })
  const trackIds = ['reads', 'calls']
  expect(
    drawnConnectionKeySections(model, theme, trackIds).map(s => s.title),
  ).toEqual(['Calls', 'Reads'])
  expect(drawnConnectionKey(model, theme, trackIds)).toEqual([
    { key: 'Calls', label: 'Calls', color: undefined },
    { key: 'Variant call', label: 'Variant call', color: '#2e7d32' },
    { key: 'Reads', label: 'Reads', color: undefined },
    expect.objectContaining({ key: RED, label: 'Read pair / LR' }),
    expect.objectContaining({ key: BLUE, label: 'Split alignment' }),
  ])
})

test('a track too zoomed out to draw adds nothing to the key', () => {
  const model = fakeModel({ drawn, tooLarge: new Set(['reads']) })
  expect(drawnConnectionKeySections(model, theme, ['reads'])).toEqual([])
})
