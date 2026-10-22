import { ConfigurationReference } from '@jbrowse/core/configuration'
import {
  getContainingTrack,
  getSession,
  openFeatureWidget,
} from '@jbrowse/core/util'
import {
  abgrAlpha,
  abgrToCssRgba,
  abgrToHex,
  cssColorToABGR,
  scaleAbgrAlpha,
} from '@jbrowse/core/util/colorBits'
import { editPlotMenuItems } from '@jbrowse/display-kit/plotMenu'
import { types } from '@jbrowse/mobx-state-tree'
import {
  PRESET_ATTRIBUTES,
  cappedMeanWidthPx,
  createComparativeColorFunction,
  declaredAttributes,
  featureAttributeRanges,
  featureColorInputs,
  getMate,
  renameRegionsForAdapter,
} from '@jbrowse/synteny-core'

import { axisX, sliceKey } from '../../CircularView/slices.ts'
import {
  BaseChordDisplay,
  installChordFetch,
} from '../../chords/BaseChordDisplay.ts'
import { ribbonHitTest } from '../../chords/chordHit.ts'
import { ribbonAnglesAt, ribbonFadeAt } from '../../chords/chordStage.ts'
import { dedupeRibbons } from '../../chords/dedupeRibbons.ts'
import { paintRuns } from '../../chords/ideogramPaint.ts'
import { ribbonLabel } from '../../chords/ribbonLabel.ts'

import type { ChordCell } from '../../chords/chordMarks.ts'
import type { RibbonLanes } from '../../chords/chordStage.ts'
import type { PaintRun } from '../../chords/ideogramPaint.ts'
import type { PartnerSpan } from '../../chords/partnerShares.ts'
import type { RibbonShape } from '../../chords/shapes.ts'
import type { ChordSyntenyDisplayConfigModel } from './configSchema.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Feature } from '@jbrowse/core/util'
import type { AlignmentData } from '@jbrowse/core/util/diagonalizeRegions'
import type { Region } from '@jbrowse/core/util/types'
import type { AttributeRange } from '@jbrowse/synteny-core'

// what a ribbon paints under the view's default mode, at the view's `opacity`
const DEFAULT_ABGR = cssColorToABGR('rgb(70,130,180)')

function defaultAbgr(value: string | undefined) {
  return value === undefined ? DEFAULT_ABGR : cssColorToABGR(value)
}

// The regions a ribbon fetch asks for: every genome's but the last's. A
// pairwise adapter answers an alignment from either end, and a ribbon draws
// only with both ends on the circle, so each pair of genomes is reached from
// the earlier one; asking the last as well read every alignment twice.
function anchorRegions(regions: Region[]) {
  const assemblies = [...new Set(regions.map(r => r.assemblyName))]
  const last = assemblies.length > 1 ? assemblies.at(-1) : undefined
  return regions.filter(r => r.assemblyName !== last)
}

// one end of an alignment, on the circle's assembly it names (undefined when
// it names none there) and in that assembly's canonical refName
interface AlignmentEnd {
  assemblyName: string | undefined
  refName: string
  start: number
  end: number
}

interface AlignmentEnds {
  own: AlignmentEnd
  mate: AlignmentEnd | undefined
  ownIsFirst: boolean
}

/**
 * #stateModel ChordSyntenyDisplay
 * Draws a `SyntenyTrack` in a `CircularView`, with a ribbon joining the two
 * spans of each alignment.
 *
 * #example
 * The circular-view display for a `SyntenyTrack`: each alignment is drawn as a
 * ribbon between its span on one side and its mate's span on the other, so an
 * inversion reads as a twist. The track config below is what creates it; its
 * colors are the config slots on [](/docs/config/chordsyntenydisplay):
 * ```js
 * {
 *   type: 'SyntenyTrack',
 *   trackId: 'volvox_self',
 *   name: 'Volvox self-alignment',
 *   assemblyNames: ['volvox', 'volvox'],
 *   adapter: {
 *     type: 'PAFAdapter',
 *     uri: 'https://example.com/volvox_self.paf',
 *     queryAssembly: 'volvox',
 *     targetAssembly: 'volvox',
 *   },
 *   displays: [
 *     {
 *       type: 'ChordSyntenyDisplay',
 *       displayId: 'volvox_self-ChordSyntenyDisplay',
 *     },
 *   ],
 * }
 * ```
 * A track aligning two assemblies needs both of them on the circle, which is
 * the view's `assembly: ['hg38', 'mm39']` — see the
 * [synteny track guide](/docs/config_guides/synteny_track).
 */
const stateModelFactory = (configSchema: ChordSyntenyDisplayConfigModel) => {
  return types
    .compose(
      'ChordSyntenyDisplay',
      BaseChordDisplay(),
      types.model({
        /**
         * #property
         */
        type: types.literal('ChordSyntenyDisplay'),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .views(self => ({
      /**
       * #getter
       * `loaded`, and no reorder this launch asked for still owed. Ribbons
       * drawn before it would be drawn against the arcs it is about to move;
       * a reorder that failed keeps this false and shows as `displayPhase`
       * error, so a capture never commits the hairball
       */
      get ready() {
        return self.loaded && !self.view.pendingAutoDiagonalize
      },
      /**
       * #getter
       * the fetch's error, or else the owed reorder's
       */
      get displayError(): unknown {
        const { view } = self
        return (
          self.error ??
          (view.pendingAutoDiagonalize ? view.diagonalizeError : undefined)
        )
      },
      /**
       * #getter
       */
      get featureNoun() {
        return 'alignment'
      },
      /**
       * #getter
       * the span or label list each color channel covers over the held
       * alignments, which the view's ramps and key scale to
       */
      get attributeRanges(): Record<string, AttributeRange> {
        return featureAttributeRanges(self.features ?? [], this.channelNames)
      },
      /**
       * #getter
       * the color channels the view's modes can paint: the preset
       * measurements and the columns the adapter declares
       */
      get channelNames() {
        return [...PRESET_ATTRIBUTES, ...declaredAttributes(self.adapterConfig)]
      },
      /**
       * #getter
       * each held alignment's two ends by its place in `features`, on the
       * circle's assemblies and in their canonical refNames: resolved once per
       * fetch, which everything placing, coloring or reordering the
       * alignments reads
       */
      get alignmentEnds(): AlignmentEnds[] {
        const [first] = self.trackAssemblyNames
        const resolve = (
          assemblyName: string | undefined,
          refName: string,
          start: number,
          end: number,
        ): AlignmentEnd => {
          const assembly = self.assemblyOf(assemblyName)
          return {
            assemblyName: assembly,
            refName:
              assembly === undefined
                ? refName
                : self.canonicalRefName(assembly, refName),
            start,
            end,
          }
        }
        return (self.features ?? []).map(feature => {
          const own = resolve(
            feature.get('assemblyName') as string | undefined,
            feature.get('refName'),
            feature.get('start'),
            feature.get('end'),
          )
          const m = getMate(feature)
          const mate = m
            ? resolve(m.assemblyName, m.refName, m.start, m.end)
            : undefined
          return { own, mate, ownIsFirst: own.assemblyName === first }
        })
      },
      /**
       * #getter
       * each alignment's packed color under the view's `color`, by its place
       * in `features`. A chromosome mode paints the ideogram color of the
       * chromosome it joins, so a ribbon matches the arc it leaves; a label
       * the view hides paints at zero alpha
       */
      get ribbonColors(): Uint32Array {
        const { view } = self
        const features = self.features ?? []
        const ends = this.alignmentEnds
        const field = view.colorField
        const { trackId } = getContainingTrack(self).configuration
        const [first, second = first] = self.trackAssemblyNames
        const genome =
          field === 'query' ? first : field === 'target' ? second : undefined
        const assembly =
          genome === undefined
            ? undefined
            : getSession(self).assemblyManager.get(genome)
        const color = createComparativeColorFunction({
          field,
          data: featureColorInputs(
            features,
            (_, i) => {
              const { own, mate, ownIsFirst } = ends[i]!
              return !mate
                ? [own.refName, own.refName]
                : ownIsFirst
                  ? [own.refName, mate.refName]
                  : [mate.refName, own.refName]
            },
            this.channelNames,
          ),
          trackColor: view.trackColorFor(trackId),
          defaultColor: defaultAbgr(view.colorValue),
          nameColor: assembly
            ? name => assembly.getRefNameColor(name)
            : undefined,
          attributeRanges: view.attributeRanges,
          paint: view.colorPaint,
          opacity: view.opacityFade,
          filter: view.predicates,
          filterExtras: {
            trackId,
            lengthOf: i =>
              Math.abs(features[i]!.get('end') - features[i]!.get('start')),
          },
        })
        return Uint32Array.from(features, (_, i) => color(i))
      },
      /**
       * #getter
       * the fill opacity every resting ribbon draws at, the view's
       * `opacityLevel`; a ribbon's own color alpha (a `color.value`'s, an
       * `opacity` field's fade) rides its lane
       */
      get shapeAlpha() {
        return self.view.opacityLevel
      },
      /**
       * #getter
       * every held alignment's feet on the circle's unrolled axis and the
       * slice index of each end, -1 off the circle, by its place in
       * `features`: rebuilt by a fetch or a change to the regions, never by a
       * recolor, a zoom or a rotation
       */
      get ribbonFeet() {
        const ends = this.alignmentEnds
        const n = ends.length
        const { byKey } = self.view.chordAxis
        const feet = {
          x1: new Float32Array(n),
          x2: new Float32Array(n),
          y1: new Float32Array(n),
          y2: new Float32Array(n),
          xGaps: new Uint32Array(n),
          yGaps: new Uint32Array(n),
          xSlice: new Int32Array(n).fill(-1),
          ySlice: new Int32Array(n).fill(-1),
          strand: new Float32Array(n),
        }
        const sliceOf = (end: AlignmentEnd) =>
          end.assemblyName === undefined
            ? undefined
            : byKey.get(sliceKey(end.assemblyName, end.refName))
        const features = self.features ?? []
        ends.forEach(({ own, mate }, i) => {
          const x = sliceOf(own)
          const y = mate && sliceOf(mate)
          if (mate && x && y) {
            feet.x1[i] = axisX(x, own.start)
            feet.x2[i] = axisX(x, own.end)
            feet.y1[i] = axisX(y, mate.start)
            feet.y2[i] = axisX(y, mate.end)
            feet.xGaps[i] = x.gaps
            feet.yGaps[i] = y.gaps
            feet.xSlice[i] = x.index
            feet.ySlice[i] = y.index
            feet.strand[i] = features[i]!.get('strand') ?? 1
          }
        })
        return feet
      },
      /**
       * #getter
       * the alignments the canvas draws, by their place in `features`, the
       * widest first so every narrower ribbon draws over them: both ends on
       * the circle, and not hidden by the view's color or its `filter`, which
       * `ribbonColors` paints at zero alpha
       */
      get ribbonPicks(): Uint32Array {
        const feet = this.ribbonFeet
        const colors = this.ribbonColors
        const picked: number[] = []
        for (let i = 0; i < colors.length; i++) {
          if (feet.xSlice[i]! >= 0 && abgrAlpha(colors[i]!) > 0) {
            picked.push(i)
          }
        }
        const span = (i: number) =>
          Math.abs(feet.x2[i]! - feet.x1[i]!) +
          Math.abs(feet.y2[i]! - feet.y1[i]!)
        return Uint32Array.from(picked.sort((a, b) => span(b) - span(a)))
      },
      /**
       * #getter
       * the drawn alignments as the ribbon mark's lanes, each in its color
       * at that color's own alpha
       */
      get ribbonLanes(): RibbonLanes {
        const feet = this.ribbonFeet
        const picks = this.ribbonPicks
        const f32 = (lane: Float32Array) =>
          Float32Array.from(picks, i => lane[i]!)
        const u32 = (lane: Uint32Array) =>
          Uint32Array.from(picks, i => lane[i]!)
        const all = self.features ?? []
        return {
          x1: f32(feet.x1),
          x2: f32(feet.x2),
          y1: f32(feet.y1),
          y2: f32(feet.y2),
          xGaps: u32(feet.xGaps),
          yGaps: u32(feet.yGaps),
          strand: f32(feet.strand),
          color: u32(this.ribbonColors),
          count: picks.length,
          features: Array.from(picks, i => all[i]!),
        }
      },
      /**
       * #getter
       * the genome whose ideogram this track paints: the second of the two it
       * joins on the circle, none for a genome aligned to itself
       */
      get paintedAssemblyName(): string | undefined {
        return self.trackAssemblyNames[1]
      },
      /**
       * #getter
       * the stretches of each painted-genome slice covered by the drawn ribbons,
       * by slice index, each in the ideogram color of the first genome's
       * chromosome it comes from; what `ideogramPaint` bins, and unchanged by a
       * zoom
       */
      get paintSpans(): ReadonlyMap<number, PaintRun[]> {
        const [first] = self.trackAssemblyNames
        const second = this.paintedAssemblyName
        const spans = new Map<number, PaintRun[]>()
        if (first === undefined || second === undefined) {
          return spans
        }
        const firstAssembly = getSession(self).assemblyManager.get(first)
        const ends = this.alignmentEnds
        const feet = this.ribbonFeet
        for (const i of this.ribbonPicks) {
          const { own, mate, ownIsFirst } = ends[i]!
          if (!mate) {
            continue
          }
          const [from, to, index] = ownIsFirst
            ? [own, mate, feet.ySlice[i]!]
            : [mate, own, feet.xSlice[i]!]
          const color = firstAssembly?.getRefNameColor(from.refName)
          if (to.assemblyName === second && color) {
            let list = spans.get(index)
            if (!list) {
              list = []
              spans.set(index, list)
            }
            list.push({ start: to.start, end: to.end, color })
          }
        }
        return spans
      },
      /**
       * #getter
       * the painted genome's ideogram, by slice key: each stretch in the
       * color of the first genome's chromosome that the drawn ribbons over it
       * mostly come from, one bin per CSS px
       */
      get ideogramPaint(): ReadonlyMap<string, PaintRun[]> {
        const { staticSlices, bpPerPx } = self.view
        const paint = new Map<string, PaintRun[]>()
        for (const [index, list] of this.paintSpans) {
          const slice = staticSlices[index]
          if (slice && !slice.region.elided) {
            paint.set(slice.key, paintRuns(list, slice.region, bpPerPx))
          }
        }
        return paint
      },
      /**
       * #getter
       * the ribbon lanes
       */
      get drawnLanes() {
        return this.ribbonLanes
      },
      /**
       * #getter
       * the drawn alignments' mean span on screen, each counted at no more
       * than the width the thin fade stops caring about, which the view's
       * 'auto' fade is decided on
       */
      get cappedMeanSpanPx() {
        const lanes = this.ribbonLanes
        return cappedMeanWidthPx(
          lanes.x1,
          lanes.x2,
          1 / (self.view.chordScale.radiansPerBp * self.radiusPx),
        )
      },
      /**
       * #method
       * lane `i` as the SVG side draws it, on the unrotated figure
       */
      shapeAt(i: number): RibbonShape {
        const lanes = this.ribbonLanes
        const { chordThinFadeFloor } = self.view
        return {
          kind: 'ribbon',
          feature: lanes.features[i]!,
          angles: ribbonAnglesAt(lanes, i, self.figureStage),
          fill: abgrToHex(lanes.color[i]!),
          opacity:
            (ribbonFadeAt(lanes, i, self.figureStage, chordThinFadeFloor) *
              abgrAlpha(lanes.color[i]!)) /
            255,
        }
      },
      /**
       * #method
       */
      shapeLabel(feature: Feature) {
        return ribbonLabel(feature)
      },
      /**
       * #getter
       * the ribbon fill the circle's key shows: the one color every ribbon
       * paints when the view's mode has no key of its own
       */
      get legendColor(): string | undefined {
        const { view } = self
        return view.colorField === ''
          ? abgrToCssRgba(
              scaleAbgrAlpha(defaultAbgr(view.colorValue), view.opacityLevel),
            )
          : undefined
      },
      /**
       * #getter
       * the panel the linear synteny displays open for the same record, so a
       * ribbon clicked on the circle and a ribbon clicked in a synteny view
       * share one drawer entry
       */
      get featureWidgetType() {
        return { type: 'SyntenyFeatureWidget', id: 'syntenyFeature' }
      },
      /**
       * #method
       * the held alignments joining two assemblies on the circle, in canonical
       * refNames and oriented reference side first, which is what the view's
       * reorder reads instead of fetching the file again
       */
      alignmentsBetween(referenceAssembly: string, currentAssembly: string) {
        const out: AlignmentData[] = []
        const features = self.features ?? []
        this.alignmentEnds.forEach(({ own, mate }, i) => {
          const [r, q] =
            own.assemblyName === referenceAssembly &&
            mate?.assemblyName === currentAssembly
              ? [own, mate]
              : own.assemblyName === currentAssembly &&
                  mate?.assemblyName === referenceAssembly
                ? [mate, own]
                : []
          if (r && q) {
            out.push({
              refRefName: r.refName,
              queryRefName: q.refName,
              refStart: r.start,
              refEnd: r.end,
              queryStart: q.start,
              queryEnd: q.end,
              strand: features[i]!.get('strand') ?? 1,
            })
          }
        })
        return out
      },
      /**
       * #getter
       * each drawn alignment's stretch on each slice it touches, by slice
       * index, named by the chromosome at its other end, with that
       * chromosome's genome where the track joins two
       */
      get partnerSpansBySlice(): ReadonlyMap<number, PartnerSpan[]> {
        const { assemblyManager } = getSession(self)
        const twoGenomes = new Set(self.trackAssemblyNames).size > 1
        const name = ({ assemblyName, refName }: AlignmentEnd) => {
          const displayName =
            assemblyName === undefined
              ? undefined
              : assemblyManager.get(assemblyName)?.displayName
          return twoGenomes && displayName
            ? `${displayName} ${refName}`
            : refName
        }
        const ends = this.alignmentEnds
        const feet = this.ribbonFeet
        const bySlice = new Map<number, PartnerSpan[]>()
        const push = (index: number, partner: string, end: AlignmentEnd) => {
          let list = bySlice.get(index)
          if (!list) {
            list = []
            bySlice.set(index, list)
          }
          list.push({ partner, start: end.start, end: end.end })
        }
        for (const i of this.ribbonPicks) {
          const { own, mate } = ends[i]!
          if (mate) {
            push(feet.xSlice[i]!, name(mate), own)
            push(feet.ySlice[i]!, name(own), mate)
          }
        }
        return bySlice
      },
      /**
       * #method
       * each drawn alignment's stretch on slice `index`, named by the
       * chromosome at its other end
       */
      partnerSpans(index: number): PartnerSpan[] {
        return this.partnerSpansBySlice.get(index) ?? []
      },
    }))
    .views(self => {
      const hitRibbon = ribbonHitTest()
      return {
        /**
         * #method
         * the topmost ribbon covering a figure point, measured on the
         * unrotated figure so a rotation keeps the held geometry
         */
        laneAt(x: number, y: number) {
          return hitRibbon(self.ribbonLanes, self.figureStage, x, y)
        },
      }
    })
    .views(self => ({
      /**
       * #getter
       * what the view's canvas draws for this display: its lanes while it is
       * ready, nothing while its loading or error ring covers the circle
       */
      get chordCell(): ChordCell | undefined {
        return self.displayPhase === 'ready'
          ? { kind: 'ribbon', lanes: self.ribbonLanes, display: self }
          : undefined
      },
    }))
    .actions(self => {
      const superReload = self.reload
      return {
        /**
         * #action
         * what a click on the canvas reaches: the alignment's details
         */
        clickFeature(feature: Feature) {
          openFeatureWidget(self, feature.toJSON(), {
            widget: self.featureWidgetType,
            feature,
          })
        },
        /**
         * #action
         * refetch, and run a reorder this launch still owes, which is how the
         * error ring's Retry reaches a reorder that failed
         */
        reload() {
          superReload()
          const { view } = self
          if (view.pendingAutoDiagonalize && !view.awaitingAutoDiagonalize) {
            void view.autoDiagonalize()
          }
        },
      }
    })
    .views(() => ({
      /**
       * #getter
       * the test id on the ribbon paths' group, on screen and in the export
       */
      get shapesTestId() {
        return 'syntenyRibbonRenderer'
      },
    }))
    .views(self => ({
      /**
       * #method
       */
      async renderSvg() {
        const { renderShapesSvg } =
          await import('../../chords/ShapeDisplay.tsx')
        return renderShapesSvg(self)
      },
    }))
    .actions(self => ({
      afterAttach() {
        installChordFetch(self, {
          name: 'ChordSyntenyDisplay',
          fetchFeatures: async ({ sessionId, adapterConfig, regions }, ctx) => {
            // A worker has no assembly manager, and a pairwise adapter compares
            // a region's assembly name against its own config text, so an alias
            // is spelled the adapter's way before the RPC (REFNAME_NAMESPACES.md)
            const renamed = await renameRegionsForAdapter({
              assemblyManager: getSession(self).assemblyManager,
              sessionId,
              adapterConfig,
              regions: anchorRegions(regions),
            })
            // One fetch per assembly, since a CoreGetFeatures request is
            // about one genome; dedupeRibbons folds an alignment a file writes
            // twice. A ribbon draws no CIGAR, and a PIF's coarse tier is the
            // same rows with the CIGAR folded: a twentieth of the bytes on a
            // chain
            const perAssembly = Map.groupBy(renamed, r => r.assemblyName)
            const fetched = await Promise.all(
              [...perAssembly.values()].map(regionsOfOne =>
                ctx.callRpc('CoreGetFeatures', {
                  adapterConfig,
                  regions: regionsOfOne,
                  opts: { lodTier: 'coarse' },
                }),
              ),
            )
            return dedupeRibbons(fetched.flat())
          },
        })
      },
    }))
    .views(self => ({
      /**
       * #method
       */
      trackMenuItems(): MenuItem[] {
        return editPlotMenuItems(self)
      },
    }))
}

export default stateModelFactory
