import { PILEUP_LAYERS } from './pileupLayers.ts'

import type { HitTestOptions } from '../components/hitTestPipeline.ts'
import type { PileupLayerId } from './pileupLayers.ts'
import type { RenderState } from './rendererTypes.ts'

/**
 * `PILEUP_LAYERS` decides what is PAINTED; `performHitTest` decides what answers
 * a hover, a click and a right-click. Both are driven by repaint-tier settings —
 * the arrays are fetched either way — so a layer switched off keeps its marks
 * live over blank pixels unless something stops them, and a miss does not fail
 * quietly: it clears the selection on click and falls through to the BROWSER's
 * context menu on right-click.
 *
 * Nothing structural connected the two lists, so this is that connection. The
 * record is exhaustive over `PileupLayerId`, which makes adding a layer a
 * compile error here until its hit-testing story is written down — the same
 * mechanism `pileupLayers.ts` already relies on to stop a layer being
 * half-added to one renderer.
 *
 * Four stories, and all four are in use, which is why this could not just be a
 * boolean:
 */
type LayerHitGate =
  // The hit test reads the SAME flag `enabled` reads, off `HitTestOptions`.
  // `hitTestPipeline.test.ts` flips each of these and asserts the marks go
  // inert; the `option` name here is what says which flag that has to be.
  | { kind: 'option'; option: keyof HitTestOptions }
  // The worker sends no data for this layer unless its setting is on, so the
  // test has nothing to find and needs no gate of its own. Load-bearing and
  // therefore named: the day the extraction stops being conditional, the marks
  // become hittable while undrawn.
  | { kind: 'noDataWhenOff'; source: string }
  // `enabled: () => true`. The hit test must then be ungated too — gating one
  // is the mirror-image bug, a drawn mark that answers nothing. `note` is for a
  // layer that still has a hit gate somewhere ABOVE the layer list.
  | { kind: 'alwaysDrawn'; note?: string }
  // Decoration painted within a read body, carrying no hit semantics of its
  // own: `hitTestFeature` already answers for every pixel it covers, and there
  // is nothing a separate test could add.
  | { kind: 'readBodyDecoration' }

const HIT_GATES: Record<PileupLayerId, LayerHitGate> = {
  // `hitTestChain` is the fallback for a hover on a chain's row but on none of
  // its reads, which is exactly where this line is drawn.
  connLine: { kind: 'option', option: 'isChainMode' },
  linkedReadLine: { kind: 'readBodyDecoration' },
  read: {
    kind: 'alwaysDrawn',
    note: 'A collapsed band (showPileup off, or a collapsed group) draws no reads because the band has zero HEIGHT, not because this gate is false. So the matching hit gate is `pileupVisible`, and it sits above the layer list — `performHitTest` returns early on it for every per-read test at once, after the coverage/indicator ones, which still run.',
  },
  overlap: { kind: 'readBodyDecoration' },
  // `modFlatbush` is built only from `modificationPositions`, which the worker
  // fills under `colorBy.type` 'modifications'/'bisulfite' — precisely
  // `isModificationScheme`, i.e. `showModifications`.
  mod: {
    kind: 'noDataWhenOff',
    source: 'extractModifications / extractMethylation / extractBisulfite',
  },
  perBaseQual: { kind: 'readBodyDecoration' },
  // Its half of `hitTestGap` runs whatever `showMismatches` says, which is what
  // `alwaysDrawn` obliges — see `hitTestCigarItem`, where the flag becomes the
  // `includeDeletions` argument rather than a gate on the call.
  skip: {
    kind: 'alwaysDrawn',
    note: 'An intron centerline is the read pass\'s own split made legible: `buildSegmentArrays` cuts a spliced read into per-exon segments, so with no line the read draws as N unrelated blocks. That is a broken picture rather than a quieter one, so it survives "show mismatches" off — unlike the `deletion` half of the same array.',
  },
  deletion: { kind: 'option', option: 'showMismatches' },
  mismatch: { kind: 'option', option: 'showMismatches' },
  insertion: { kind: 'option', option: 'showMismatches' },
  clip: { kind: 'alwaysDrawn' },
  // `softclipBasePositions` comes from `showSoftClipping ? softclips : []`.
  softclipBases: {
    kind: 'noDataWhenOff',
    source: 'buildAlignmentDetailArrays softclipBaseArrays',
  },
  perBaseLetter: { kind: 'readBodyDecoration' },
}

// Two RenderStates that differ in every boolean, so a layer's `enabled` can be
// asked whether it gates on anything at all without naming which flag.
function renderState(flags: boolean): RenderState {
  return {
    chainMode: flags,
    collapseGroupRows: flags,
    showLinkedReadLines: flags,
    showMismatches: flags,
    showSoftClipping: flags,
    showModifications: flags,
    showPerBaseQuality: flags,
    showPerBaseLetter: flags,
    // `shouldDrawOverlaps` also needs a drawable row height; keep it constant so
    // it is the booleans alone that vary.
    featureHeight: 10,
  } as unknown as RenderState
}

const ALL_ON = renderState(true)
const ALL_OFF = renderState(false)

it('classifies every drawn layer', () => {
  // Both directions: a layer with no entry is a missing decision, an entry with
  // no layer is a stale one left behind by a removal.
  expect(PILEUP_LAYERS.map(l => l.id).sort()).toEqual(
    Object.keys(HIT_GATES).sort(),
  )
})

// The classification has to describe the layer it is filed under, or it is a
// comment that happens to be typed. `enabled` answering the same for all-flags-on
// and all-flags-off is the definition of an ungated layer.
it('agrees with each layer about whether it is gated at all', () => {
  for (const layer of PILEUP_LAYERS) {
    const unconditional = layer.enabled(ALL_ON) && layer.enabled(ALL_OFF)
    expect({
      id: layer.id,
      unconditional,
    }).toEqual({
      id: layer.id,
      unconditional: HIT_GATES[layer.id].kind === 'alwaysDrawn',
    })
  }
})

// A gated layer must actually turn off, or its `enabled` is a no-op dressed as a
// setting and the hit gate opposite it protects nothing.
it('every gated layer stops drawing with its flags off', () => {
  for (const layer of PILEUP_LAYERS) {
    if (HIT_GATES[layer.id].kind !== 'alwaysDrawn') {
      expect({ id: layer.id, drawn: layer.enabled(ALL_OFF) }).toEqual({
        id: layer.id,
        drawn: false,
      })
    }
  }
})

// The flag a layer is filed under has to exist on `HitTestOptions` — that is
// what makes `performHitTest` able to read the same one. Typed above, so this
// only guards the runtime half: an option renamed on the interface without the
// record following.
it('names option gates that HitTestOptions actually carries', () => {
  const OPTION_KEYS: Record<keyof HitTestOptions, true> = {
    showInterbaseIndicators: true,
    coverageHeight: true,
    coverageMaxDepth: true,
    coverageSnpMinFrequency: true,
    topOffset: true,
    coverageTopOffset: true,
    featureHeight: true,
    featureSpacing: true,
    scrollTop: true,
    isChainMode: true,
    filterMismatchesByFrequency: true,
    showMismatches: true,
    pileupVisible: true,
    colorScheme: true,
  }
  for (const gate of Object.values(HIT_GATES)) {
    if (gate.kind === 'option') {
      expect(OPTION_KEYS[gate.option]).toBe(true)
    }
  }
})
