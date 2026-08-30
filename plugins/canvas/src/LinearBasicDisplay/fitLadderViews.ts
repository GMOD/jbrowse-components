import { HEIGHT_MULTIPLIERS } from '../RenderFeatureDataRPC/glyphs/glyphUtils.ts'
import {
  MIN_FIT_BOX_PX,
  resolveFitLadder,
  solveIsoformCount,
  solveLabelRoomFactor,
  squeezeFloorScale,
} from './fitLadder.ts'
import { maxIsoformCount } from './isoformTrim.ts'
import {
  createContentHeightProbe,
  createIncrementalLayout,
  createIsoformCountProbe,
  minDrawnBoxHeight,
} from './layout.ts'

import type { DisplayMode } from '../RenderFeatureDataRPC/renderConfig.ts'
import type { FeatureDataResult } from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { FitRung, FitStage } from './fitLadder.ts'
import type {
  IncrementalLayout,
  IsoformCountFreeInputs,
  LabelRoomFactorFreeInputs,
  LayoutInputs,
  LayoutRegionData,
} from './layout.ts'

/**
 * What the fit ladder reads off the display that installs it. The five memo
 * instances are volatiles the display holds (see `fitLadderVolatiles`); the
 * rest are the layout inputs and the height-mode answers the ladder is solved
 * against.
 */
export interface FitLadderHost {
  rpcDataMap: ReadonlyMap<number, LayoutRegionData>
  layoutReady: boolean
  // `expandedGeneIds` is Required, not merely picked: every rung spreads these
  // inputs, so a host that could omit it is a host whose `full` rung
  // re-collapses the gene the user opened.
  layoutInputs: Pick<
    LayoutInputs,
    'bpPerPx' | 'reversedRegions' | 'displayMode' | 'pinnedFeatureIds'
  > &
    Required<Pick<LayoutInputs, 'expandedGeneIds'>>
  showLabels: boolean
  effectiveShowDescriptions: boolean
  displayMode: DisplayMode
  fitMeasureFeatureIds: ReadonlySet<string> | undefined
  fitHeightToDisplay: boolean
  // grow mode: the track's height IS its content's, so nothing is ever trimmed
  autoHeight: boolean
  // "All transcripts": the setting names every isoform, so the rung that would
  // drop one is withheld and the surplus scrolls
  showsEveryIsoform: boolean
  fitTargetHeight: number
  incrementalLayout: IncrementalLayout
  incrementalLayoutLabelsOnly: IncrementalLayout
  incrementalLayoutBodiesOnly: IncrementalLayout
  incrementalLayoutDecimated: IncrementalLayout
  incrementalLayoutIsoforms: IncrementalLayout
}

/**
 * The five packing memos the ladder escalates through. One instance per
 * reservation config, so each keeps its own stable per-group references and
 * prior-row ordering — a single shared instance can only cache one config at a
 * time.
 */
export function fitLadderVolatiles() {
  return {
    /**
     * #volatile
     */
    // Per-instance memo backing `laidOutDataMap`. Stateful (holds the
    // previous per-ref-group layout) so unchanged chromosomes keep stable
    // object references — turns whole-genome layout/upload from O(N²) to
    // O(N). The volatile holds a stable reference; mutating its internal
    // cache is invisible to MobX, so reading it in the computed is safe.
    incrementalLayout: createIncrementalLayout(),
    /**
     * #volatile
     */
    // Fit-mode escalation layouts (see `fitStage`).
    incrementalLayoutLabelsOnly: createIncrementalLayout(),
    /**
     * #volatile
     */
    incrementalLayoutBodiesOnly: createIncrementalLayout(),
    /**
     * #volatile
     */
    // The `decimated` rung's memo. Unlike its three siblings this one packs
    // WITHOUT prior-row seeding (`seedPriorRows: false`), because the rung's
    // whitespace factor is chosen by measuring unseeded candidate packs and
    // the commit has to match what was measured — see `fitDecimatedSolved`.
    // Its job here is purely to hand back the same stack by reference when
    // the solve lands on the factor it already committed, which is the common
    // case: every pan settle and every drag-resize frame re-solves, and most
    // of those re-solve to the same factor over the same data.
    incrementalLayoutDecimated: createIncrementalLayout({
      seedPriorRows: false,
    }),
    /**
     * #volatile
     */
    // The `isoforms` rung's memo, unseeded for the same reason its `decimated`
    // sibling is: the isoform count is chosen by MEASURING candidate packs, so
    // the commit has to pack the way the probe did. Its job here is to hand
    // back the same stack by reference when the solve lands on the count it
    // already committed — every pan settle and every drag-resize frame
    // re-solves, and most of those land on the same count over the same data.
    incrementalLayoutIsoforms: createIncrementalLayout({
      seedPriorRows: false,
    }),
  }
}

/**
 * The fit ladder: every candidate stack, the two solves that choose the
 * `isoforms` rung's transcript count and the `decimated` rung's whitespace
 * factor, the scale bounds, and the `fitStage` that resolves them into one
 * outcome.
 *
 * A plain `.views()` layer rather than a mixin: `types.compose` depth is a real
 * ceiling in this chain (ADR-041), and the ladder reads `height`-mode and
 * layout members contributed by mixins the display already composes.
 */
export function fitLadderViews(self: FitLadderHost) {
  return {
    /**
     * #method
     * One fit-escalation candidate: the stack packed with the given
     * label/description reservation, via that config's own memo instance so
     * each keeps stable references across renders. Empty until
     * initialized/in-bounds, so the GPU upload autorun has nothing to push.
     */
    fitLayoutAt(
      memo: IncrementalLayout,
      showLabels: boolean,
      showDescriptions: boolean,
    ): Map<number, FeatureDataResult> {
      return self.layoutReady
        ? memo(self.rpcDataMap, {
            ...self.layoutInputs,
            showLabels,
            showDescriptions,
          })
        : new Map<number, FeatureDataResult>()
    },
    /**
     * #getter
     * The `decimated` rung's layout inputs minus the whitespace factor. Typed
     * without `labelRoomFactor` so the solve's shared preparation provably can't
     * depend on it (see createContentHeightProbe).
     */
    get decimatedBaseInputs(): LabelRoomFactorFreeInputs {
      return {
        ...self.layoutInputs,
        showLabels: self.showLabels,
        showDescriptions: false,
        labelDecimation: 'fitWidth',
        // The rungs below `isoforms` inherit the count that rung failed at —
        // every isoform goes before any name does, so once the trim has run
        // out of room there is no going back to the full stack to save a name.
        maxIsoformsPerGene: this.fitIsoformCount,
      }
    },
    /**
     * #method
     * Layout inputs for the `decimated` rung at one whitespace factor. Every
     * probe and the committed layout go through this single builder, so the
     * stack the solve measures cannot differ from the stack it commits by a
     * forgotten field.
     */
    decimatedLayoutInputs(labelRoomFactor: number): LayoutInputs {
      return { ...this.decimatedBaseInputs, labelRoomFactor }
    },
    /**
     * #getter
     * Measures the `decimated` rung's stack height at any whitespace factor,
     * against the features the ladder measures its rungs with — so the factor
     * the solve picks is judged on the same stack the rung is then kept or
     * rejected on.
     *
     * A getter, not a call inside the solve, because the preparation it holds
     * (per-kind label widths, the two neighbor-room sorts — about a fifth of
     * a layout) depends on the data and the layout inputs but NOT on the track
     * height. Dragging the resize handle re-solves every frame; caching it
     * here keeps those frames to the bisection's packs alone.
     */
    get decimatedHeightProbe(): (labelRoomFactor: number) => number {
      return createContentHeightProbe(
        self.rpcDataMap,
        this.decimatedBaseInputs,
        undefined,
        self.fitMeasureFeatureIds,
      )
    },
    /**
     * #method
     * The whitespace factor the `decimated` rung commits at: the smallest one
     * whose packed stack fits `trackHeight` (smallest = most names kept), or
     * undefined when even the most aggressive decimation overflows. The
     * bisection lives in `solveLabelRoomFactor` (fitLadder.ts), next to the
     * ladder walk it serves.
     */
    solveLabelRoomFactor(trackHeight: number) {
      return solveLabelRoomFactor(this.decimatedHeightProbe, trackHeight)
    },
    /**
     * #getter
     * The `isoforms` rung's layout inputs minus the count itself, typed without
     * it so the solve's shared preparation provably cannot depend on it. Same
     * reservation as `labels` — names kept, descriptions dropped — because the
     * whole point of the rung is that names survive the trim.
     */
    get isoformsBaseInputs(): IsoformCountFreeInputs {
      return {
        ...self.layoutInputs,
        showLabels: self.showLabels,
        // Fit mode reaches this rung only after `labels` overflowed, so
        // descriptions are already gone. Fixed height never passed through
        // that rung and keeps whatever the settings asked for: it scrolls
        // rather than degrading, and trimming is the one thing it does.
        showDescriptions: self.fitHeightToDisplay
          ? false
          : self.effectiveShowDescriptions,
      }
    },
    /**
     * #getter
     * Measures the `isoforms` rung's stack height at any isoform count, against
     * the features the ladder measures its rungs with.
     *
     * A getter for the reason `decimatedHeightProbe` is one: the preparation it
     * holds depends on the data and the layout inputs but NOT on the track
     * height, and dragging the resize handle re-solves every frame.
     */
    get isoformsHeightProbe(): (maxIsoforms: number) => number {
      return createIsoformCountProbe(
        self.rpcDataMap,
        this.isoformsBaseInputs,
        self.fitMeasureFeatureIds,
      )
    },
    /**
     * #getter
     * The most isoforms any gene ON SCREEN has — the top of the solve's
     * bracket, and the count above which a trim can take nothing away.
     */
    get maxIsoformsOnScreen() {
      return maxIsoformCount(
        self.rpcDataMap.values(),
        self.fitMeasureFeatureIds,
      )
    },
    /**
     * #getter
     * The isoform count the `isoforms` rung commits at: the largest whose
     * names-kept stack fits `fitTargetHeight`, so the most transcripts are kept
     * without giving up a name. Undefined when nothing is worth trimming.
     *
     * When even one transcript per gene overflows, fit mode commits to 1 — which
     * the `decimated` and `bodies` rungs below then inherit, every isoform going
     * before any name does — while fixed mode leaves the stack whole and
     * scrolls. Fixed has no rung below the trim, so a trim that cannot achieve a
     * fit there costs every transcript and scrolls anyway.
     *
     * Never in `grow`, whose height is its own content's — trimming there would
     * shrink the track it was measured against. Never under "All transcripts"
     * either: that setting is a promise the menu makes in those words, so the
     * rung is withheld and the stack scrolls rather than losing a transcript.
     * The rungs below it then inherit `undefined` and pack the full stack, so
     * the ladder gives up descriptions and names — the reductions the reader
     * asked for by naming the transcripts first.
     */
    get fitIsoformCount(): number | undefined {
      return self.layoutReady && !self.autoHeight && !self.showsEveryIsoform
        ? solveIsoformCount(
            this.isoformsHeightProbe,
            self.fitTargetHeight,
            this.maxIsoformsOnScreen,
            self.fitHeightToDisplay ? 1 : undefined,
          )
        : undefined
    },
    /**
     * #getter
     * The `isoforms` stack: every gene trimmed to `fitIsoformCount`
     * transcripts, names intact. Falls back to the `labels` stack when there is
     * nothing to trim.
     */
    get fitIsoformsSolved(): Map<number, FeatureDataResult> {
      const maxIsoformsPerGene = this.fitIsoformCount
      if (maxIsoformsPerGene === undefined) {
        return self.fitHeightToDisplay
          ? this.fitLabelsOnlyLayout
          : this.baseLaidOutDataMap
      }
      return self.incrementalLayoutIsoforms(self.rpcDataMap, {
        ...this.isoformsBaseInputs,
        maxIsoformsPerGene,
      })
    },
    /**
     * #getter
     * Full reservation (names + descriptions): rendered at fit stage `full`
     * and in non-fit modes, and the first stack `fitStage` probes.
     */
    get baseLaidOutDataMap(): Map<number, FeatureDataResult> {
      return this.fitLayoutAt(
        self.incrementalLayout,
        self.showLabels,
        self.effectiveShowDescriptions,
      )
    },
    /**
     * #getter
     * Names reserved, descriptions dropped — the `labels` stage's stack. With
     * descriptions already off (config, or the auto density gate) this rung's
     * reservation is the base one, so reuse that stack by reference rather than
     * packing a byte-identical copy into a second memo.
     */
    get fitLabelsOnlyLayout(): Map<number, FeatureDataResult> {
      return self.effectiveShowDescriptions
        ? this.fitLayoutAt(
            self.incrementalLayoutLabelsOnly,
            self.showLabels,
            false,
          )
        : this.baseLaidOutDataMap
    },
    /**
     * #getter
     * The whitespace factor the `decimated` rung commits at: the smallest
     * one whose packed stack fits `fitTargetHeight`, so the most names are
     * kept. Undefined when there is nothing to decimate (names off) or when
     * even the most aggressive factor overflows.
     */
    get fitDecimatedFactor(): number | undefined {
      // A memoized getter rather than the bare `solveLabelRoomFactor` call
      // it replaces, so `rowGeometrySignature` reads the same answer the
      // rung packed at without paying for a second bisection (~9 packs).
      return self.layoutReady && self.showLabels
        ? this.solveLabelRoomFactor(self.fitTargetHeight)
        : undefined
    },
    /**
     * #getter
     * The `decimated` stack: names kept only on features with at least
     * `fitDecimatedFactor ×` their label width in neighbour whitespace (plus
     * pinned/highlighted, always). Filling the height with as many
     * non-overlapping names as fit, rather than snapping between a few fixed
     * rungs, is what this rung is for; it decimates by isolation, not by any
     * notion of feature importance. Falls back to the `labels` stack when
     * there is nothing to decimate or no factor fits.
     */
    get fitDecimatedSolved(): Map<number, FeatureDataResult> {
      // Probe and commit must pack identically or the committed stack
      // overflows the height the solve fit, the ladder descends to `bodies`
      // and every name vanishes on the tallest tracks. Hence
      // `incrementalLayoutDecimated`, built with `seedPriorRows: false` to
      // match the unseeded probe; the memo is there for reference stability
      // across the re-solve every pan settle and drag frame triggers.
      //
      // Seeding this rung from the factor-independent `labels` stack was
      // tried and moved zero rows — that seed's order and the
      // `layoutStartBp` tiebreak it would replace already coincide. Don't
      // re-add it without a measurement.
      const factor = this.fitDecimatedFactor
      // The `isoforms` stack, not the `labels` one, when there is nothing to
      // decimate: this rung is BELOW that one, so falling back past its trim
      // packs a stack the ladder has already rejected — and reports the count
      // over it. With names off there is never a factor, which is exactly when
      // the stacks are deepest.
      return factor === undefined
        ? this.fitIsoformsSolved
        : self.incrementalLayoutDecimated(
            self.rpcDataMap,
            this.decimatedLayoutInputs(factor),
          )
    },
    get fitBodiesOnlyLayout(): Map<number, FeatureDataResult> {
      const maxIsoformsPerGene = this.fitIsoformCount
      // With names already off this rung's reservation is the base one, so the
      // stack is shared by reference rather than packed a second time — but
      // only while there is no trim to apply, or the reuse drops it.
      return self.showLabels || maxIsoformsPerGene !== undefined
        ? self.incrementalLayoutBodiesOnly(self.rpcDataMap, {
            ...self.layoutInputs,
            showLabels: false,
            showDescriptions: false,
            maxIsoformsPerGene,
          })
        : this.fitLabelsOnlyLayout
    },
    /**
     * #getter
     * The unscaled height (px) of the shortest box on screen that the layout
     * actually DRAWS — a UTR at its 0.65 fraction, a transcript rect inside a
     * gene, a plain variant box — which is the one a uniform squeeze takes
     * below a visible size first, and so the basis for the squeeze floor
     * below. 0 when nothing is drawn, which makes that floor a no-op.
     *
     * A drawn box, not a feature's laid-out extent, and the distinction is the
     * whole floor: a gene's extent is every stacked transcript plus its label
     * rows, so a floor built on it promised 2px boxes while letting each
     * transcript render at a third of a pixel. See `minDrawnBoxHeight`.
     *
     * Measured off the layout, never off the `featureHeight` config slot. The
     * slot is a per-feature jexl callback slot (`contextVariable:
     * ['feature']`), so reading it here — with no feature in scope —
     * evaluates the callback against nothing and throws, taking the whole fit
     * layout down with it. And even where it holds a plain number it names
     * the plain-rect glyph's row height, which is not what a UTR or an
     * isoform inside a gene is drawn at.
     *
     * Reads the `full` rung specifically because it is the stack the ladder
     * always materializes, so it costs nothing extra. Box HEIGHTS don't vary
     * across rungs (only the label reservation does), but the set of boxes
     * counted can: `minDrawnBoxHeight` skips a feature the packer left
     * unplaced, and `bodies` — the only rung a squeeze ever runs on — packs
     * tighter and so places features `full` pushed past the row limit. On a
     * stack deep enough to truncate at `full`, the floor is therefore
     * measured over a subset and can allow a squeeze slightly past the
     * MIN_FIT_BOX_PX promise. Reading it off `bodies` instead would be
     * circular — that layout is chosen using this scale.
     *
     * Narrowed to `fitMeasureFeatureIds`, the same on-screen set every rung
     * is measured over.
     */
    get fitSmallestBoxPx() {
      return minDrawnBoxHeight(
        this.baseLaidOutDataMap,
        self.fitMeasureFeatureIds,
      )
    },
    /**
     * #getter
     * Floor on the fit squeeze: the smallest vertical scale that still leaves
     * every drawn box at least `MIN_FIT_BOX_PX` tall. When boxes would pack
     * tighter than this the squeeze stops here and the surplus scrolls instead
     * of vanishing. `squeezeFloorScale` answers both degenerate cases (nothing
     * drawn, or boxes already at the minimum) as 1 — no squeeze available — so
     * there is nothing to clamp or zero-check here.
     */
    get fitMinScale() {
      return squeezeFloorScale(this.fitSmallestBoxPx, MIN_FIT_BOX_PX)
    },
    /**
     * #getter
     * Ceiling on the fit grow: the largest vertical scale before a feature body
     * exceeds the height it would have outside fit mode. A sparse stack grows
     * to fill the track only until its bodies reach that height, so fit never
     * makes a feature taller than the display normally draws it. In normal
     * display mode the laid-out body already is that height, pinning the scale
     * at 1 (no grow, surplus stays whitespace); a compact mode may grow back up
     * to — but not past — it.
     *
     * That works out to exactly `1 / multiplier`, with no body height read at
     * all: the grow target is the unmultiplied height and the laid-out body is
     * that height times the mode's multiplier, so it cancels whatever it was
     * per feature and the ceiling is purely the display mode's compact ratio (1
     * in normal mode → no grow). Unlike the squeeze floor, which has to know
     * the shortest actual box (see `fitSmallestBoxPx`), this bound is uniform.
     */
    get fitMaxScale() {
      return Math.max(1, 1 / HEIGHT_MULTIPLIERS[self.displayMode])
    },
    /**
     * #getter
     * The resolved fit outcome — which reservation `level` survived, its
     * unscaled `layout`, and the vertical `scale` to fill the track — bundled
     * so the three can never disagree. The ladder keeps the least reduction
     * whose *unscaled* stack fits the track height: `full` (names +
     * descriptions), else `labels` (drop descriptions), else `decimated` at a
     * whitespace factor solved to the height (`fitDecimatedSolved` — keeps as
     * many non-overlapping names as fit, filling the space continuously), else
     * `bodies` (drop names too, pack tight) when even the tightest decimation
     * overflows. The kept rung is then scaled to fill the track: grown up to
     * `fitMaxScale` when it fits with room to spare, but never past the normal
     * feature height — so in normal display mode grow is pinned at 1 and spare
     * space stays whitespace, while a compact mode may enlarge back up to
     * normal; or — only at the last `bodies` rung — squeezed down to
     * `fitMinScale` and scrolled if even that overflows. Non-fit modes stay at
     * `full`, scale 1. Read off the unscaled candidate heights so it can't feed
     * back on its own `scale`. The ladder walk + scale math live in
     * `resolveFitLadder`.
     *
     * Every rung is measured over `fitMeasureFeatureIds` — on screen in fit
     * mode, everything otherwise — so the rung that survives and the squeeze
     * it gets are decided by the stack in view, not by the half-viewport of
     * buffered features packed on either side of it.
     */
    get fitStage(): FitStage {
      const base = this.baseLaidOutDataMap
      const fit = self.fitHeightToDisplay
      // Non-fit mode is the `full` rung with no scaling freedom:
      // minScale=maxScale=1 pins the scale at 1 and the lone rung lays out
      // only `base` (resolveFitLadder returns immediately on the last rung).
      // Routing both modes through resolveFitLadder keeps FitStage assembled
      // in one place, so its fields (level/layout/scale/contentHeight) can't
      // drift apart.
      // A thunk: the solve packs, and a stack that fits at `full` never asks.
      const trimmed = () => this.fitIsoformCount
      const full: FitRung = { level: 'full', layout: () => base }
      // "All transcripts" leaves the ladder no isoform rung at all, rather than
      // one that solves to `undefined` and trims nothing: kept, it is the LAST
      // rung of the fixed-height ladder, which is always the one resolved, so
      // the stage would report `level: 'isoforms'` over a stack every transcript
      // survived.
      const isoformRung: FitRung[] = self.showsEveryIsoform
        ? []
        : [
            {
              level: 'isoforms',
              layout: () => this.fitIsoformsSolved,
              maxIsoforms: trimmed,
            },
          ]
      return resolveFitLadder(
        fit
          ? [
              full,
              { level: 'labels', layout: () => this.fitLabelsOnlyLayout },
              ...isoformRung,
              {
                level: 'decimated',
                layout: () => this.fitDecimatedSolved,
                maxIsoforms: trimmed,
              },
              {
                level: 'bodies',
                layout: () => this.fitBodiesOnlyLayout,
                maxIsoforms: trimmed,
              },
            ]
          : self.autoHeight
            ? // Grow's height IS its content's, so it gives nothing up.
              [full]
            : // Fixed height scrolls rather than degrading, but it trims where
              // trimming achieves a fit: a gene with 28 transcripts in a 100px
              // lane draws the count that fits, which is the case the worker's
              // cap was built for and the one `grow` deliberately keeps. Where
              // no count fits, `fitIsoformCount` is undefined and this rung
              // packs the whole stack into the lane's own scrollbar.
              [full, ...isoformRung],
        self.fitTargetHeight,
        fit ? this.fitMinScale : 1,
        fit ? this.fitMaxScale : 1,
        self.fitMeasureFeatureIds,
      )
    },
  }
}
