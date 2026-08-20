import { refNamePaletteColorAt } from '@jbrowse/core/ui/colors'
import { cssColorToRgb, packAbgr } from '@jbrowse/core/util/colorBits'
import { waitFor } from '@testing-library/react'

import { makePileupDataResult } from '../RenderAlignmentDataRPC/testPileupData.ts'
import { bootAlignmentsDisplay } from './testUtils.ts'

import type { GroupedAlignmentsResult } from '../RenderAlignmentDataRPC/types.ts'

// Chromosome painting resolves a mate reference against the ASSEMBLY's own
// chromosome order, which is what stops two chromosomes sharing a colour. The
// rule and its fallback are `refNameColor`'s (core) and the bake's; what only a
// booted display can say is that the display hands the order over AT ALL, and
// that it canonicalizes the name first.
//
// Both halves fail silently. A display that passes no order, and a display whose
// probe misses because it compared a file's `12` against a canonical `chr12`,
// both land on the same hash fallback — a real colour, plausible on screen, and
// the one this scheme was moved off. So the fixture deliberately spells the
// assembly and the file differently, which is the ordinary case for a
// GRCh37-style BAM read against an hg38-style assembly.

const ASSEMBLY_REFNAMES = ['chr1', 'chr12']

// `1` in the file is `chr1` to the assembly. `getCanonicalRefName2` is the one
// the display is required to go through; an alias table is what it reads.
const CANONICAL: Record<string, string> = { '1': 'chr1', '12': 'chr12' }

const packed = (color: string) => {
  const [r, g, b] = cssColorToRgb(color)
  return packAbgr(r, g, b, 255)
}

function createDisplay() {
  console.warn = jest.fn()
  const { baseSession, mount } = bootAlignmentsDisplay()
  const asm = {
    initialized: true,
    regions: ASSEMBLY_REFNAMES.map(refName => ({
      refName,
      start: 0,
      end: 500_000,
      assemblyName: 'volvox',
    })),
    refNameToIndex: new Map(ASSEMBLY_REFNAMES.map((n, i) => [n, i])),
    getCanonicalRefName: (refName: string) => CANONICAL[refName] ?? refName,
    getCanonicalRefName2: (refName: string) => CANONICAL[refName] ?? refName,
  }
  // Two reads on the region's own contig, whose mates sit on the two
  // chromosomes the OLD hash put on one colour.
  const data: GroupedAlignmentsResult = {
    groups: [
      {
        key: '',
        label: '',
        data: makePileupDataResult({
          readPositions: Uint32Array.of(100, 200, 300, 400),
          readStrands: Int8Array.of(1, 1),
          readTagValues: ['1', '12'],
        }),
      },
    ],
  }
  const Session = baseSession
    .volatile(() => ({
      rpcManager: { call: () => Promise.resolve(data) },
      assemblyManager: {
        get: (name: string) => (name === 'volvox' ? asm : undefined),
        waitForAssembly: () => Promise.resolve(asm),
        isValidRefName: () => true,
      },
    }))
    .actions(() => ({
      notify() {},
      notifyError() {},
    }))
  const { view, display } = mount(Session)
  view.setWidth(800)
  view.setDisplayedRegions([
    { assemblyName: 'volvox', start: 0, end: 100_000, refName: 'chr1' },
  ])
  return { view, display }
}

async function loadedDisplay() {
  const { display } = createDisplay()
  display.setColorScheme({ type: 'mateRefName' })
  jest.advanceTimersByTime(400)
  await jest.runAllTimersAsync()
  await waitFor(() => {
    expect(display.loadedRegions.size).toBe(1)
  })
  return display
}

beforeEach(() => {
  jest.useFakeTimers()
})
afterEach(() => {
  jest.useRealTimers()
})

test('a mate reference resolves through the assembly order, in the file spelling', async () => {
  const display = await loadedDisplay()
  const position = display.paintedRefNamePosition
  expect(position).toBeDefined()
  // The file's spelling, not the assembly's — that is the whole probe.
  expect(position!('1')).toBe(0)
  expect(position!('12')).toBe(1)
  // A contig the assembly does not list has no position, and falls back rather
  // than resolving to something.
  expect(position!('chrUn_scaffold')).toBeUndefined()
})

test('the order reaches the baked read colors', async () => {
  const display = await loadedDisplay()
  const [byRegion] = [...display.laidOutByGroup.values()]
  const [region] = [...byRegion!.values()]
  expect([...region!.readTagColors]).toEqual([
    packed(refNamePaletteColorAt(0)),
    packed(refNamePaletteColorAt(1)),
  ])
})

// The scheme is the gate: nothing else pays for a Map probe per distinct value,
// and a tag value is not a refName.
test('no position is offered under a scheme that is not chromosome painting', async () => {
  const display = await loadedDisplay()
  display.setColorScheme({ type: 'tag', tag: 'HP' })
  expect(display.paintedRefNamePosition).toBeUndefined()
})
