import { resolvePalette } from '@jbrowse/core/ui/palette'

import { connectedVariantJunctions } from './connectedJunctions.ts'
import {
  drawnConnectionKey,
  drawnConnectionKeySections,
} from './overlayUtils.tsx'

import type { BreakpointViewModel } from '../model.ts'

jest.mock('./connectedJunctions.ts', () => ({
  connectedVariantJunctions: jest.fn(() => []),
}))

const theme = resolvePalette()
const RED = '#ff0000'
const BLUE = '#0000ff'

interface FakeDrawn {
  kind: string
  color: string
  label: string
  connection: { hiddenSegmentsBetween?: { refName: string }[] }
}

function fakeModel({
  tooLarge = new Set<string>(),
  drawn = new Map<string, FakeDrawn[]>(),
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
      {
        kind: 'splitInverted',
        color: BLUE,
        label: 'Split alignment',
        connection: {},
      },
      { kind: 'readPair', color: RED, label: 'Read pair', connection: {} },
      { kind: 'pairLR', color: RED, label: 'LR', connection: {} },
    ],
  ],
])

function drawEveryCall() {
  jest
    .mocked(connectedVariantJunctions)
    .mockImplementation(({ match }) =>
      match.kind === 'variant'
        ? ([{}] as ReturnType<typeof connectedVariantJunctions>)
        : [],
    )
}

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
  drawEveryCall()
  const model = fakeModel({ drawn })
  const trackIds = ['reads', 'calls']
  expect(
    drawnConnectionKeySections(model, theme, trackIds).map(s => s.title),
  ).toEqual(['Calls', 'Reads'])
  expect(drawnConnectionKey(model, theme, trackIds)).toEqual([
    { key: 'Calls', label: 'Calls', color: undefined },
    { key: 'Variant call', label: 'Variant call', color: theme.variantCall },
    { key: 'Reads', label: 'Reads', color: undefined },
    expect.objectContaining({ key: RED, label: 'Read pair / LR' }),
    expect.objectContaining({ key: BLUE, label: 'Split alignment' }),
  ])
})

test('a track too zoomed out to draw adds nothing to the key', () => {
  drawEveryCall()
  const model = fakeModel({ drawn, tooLarge: new Set(['reads', 'calls']) })
  expect(drawnConnectionKeySections(model, theme, ['reads', 'calls'])).toEqual(
    [],
  )
})

test('the connectors through regions not shown key one fixed row', () => {
  const grey = theme.readThroughHidden
  const through = (...refNames: string[]) => ({
    kind: 'splitInverted',
    color: grey,
    label: 'Split read (skips parts aligned outside this view)',
    connection: {
      hiddenSegmentsBetween: refNames.map(refName => ({ refName })),
    },
  })
  const model = fakeModel({
    drawn: new Map([
      [
        'reads',
        [
          through('chr10', 'chr12'),
          { kind: 'readPair', color: RED, label: 'Read pair', connection: {} },
          through('chr12'),
        ],
      ],
    ]),
  })
  expect(drawnConnectionKey(model, theme, ['reads']).map(r => r.label)).toEqual(
    ['Read pair', 'Split read (skips parts aligned outside this view)'],
  )
})
