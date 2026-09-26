import { ConfigurationReference } from '@jbrowse/core/configuration'
import {
  getContainingTrack,
  getSession,
  openFeatureWidget,
} from '@jbrowse/core/util'
import {
  abgrAlpha,
  abgrBlue,
  abgrGreen,
  abgrRed,
  abgrToCssRgba,
  cssColorToABGR,
  withAbgrAlpha,
} from '@jbrowse/core/util/colorBits'
import { types } from '@jbrowse/mobx-state-tree'
import {
  PRESET_ATTRIBUTES,
  createComparativeColorFunction,
  declaredAttributes,
  featureAttributeRanges,
  featureColorInputs,
  getMate,
  renameRegionsForAdapter,
} from '@jbrowse/synteny-core'

import {
  BaseChordDisplay,
  installChordFetch,
} from '../../chords/BaseChordDisplay.ts'
import { ribbonHitTest } from '../../chords/chordHit.ts'
import { axisX, ribbonAnglesAt } from '../../chords/chordStage.ts'
import { dedupeRibbons } from '../../chords/dedupeRibbons.ts'
import { ribbonLabel } from '../../chords/ribbonLabel.ts'
import { shapePath } from '../../chords/shapePath.ts'
import { DIMMED_ALPHA } from '../../chords/types.ts'

import type { ExportSvgOptions } from '../../CircularView/model.ts'
import type { ChordCell } from '../../chords/chordMarks.ts'
import type { RibbonLanes } from '../../chords/chordStage.ts'
import type { RibbonShape } from '../../chords/shapes.ts'
import type { ChordSyntenyDisplayConfigModel } from './configSchema.ts'
import type { Feature } from '@jbrowse/core/util'
import type { AlignmentData } from '@jbrowse/core/util/diagonalizeRegions'
import type { AttributeRange } from '@jbrowse/synteny-core'
import type { ThemeOptions } from '@mui/material'

// what a ribbon paints under the view's default mode, at the view's `alpha`
const DEFAULT_ABGR = cssColorToABGR('rgb(70,130,180)')

function defaultAbgr(value: string | undefined) {
  return value === undefined ? DEFAULT_ABGR : cssColorToABGR(value)
}

function opaqueHex(abgr: number) {
  return `#${[abgrRed(abgr), abgrGreen(abgr), abgrBlue(abgr)]
    .map(channel => channel.toString(16).padStart(2, '0'))
    .join('')}`
}

function atAlpha(abgr: number, alpha: number) {
  return abgrToCssRgba(withAbgrAlpha(abgr, Math.round(abgrAlpha(abgr) * alpha)))
}

/**
 * #stateModel ChordSyntenyDisplay
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
       * the span or label list each colour channel covers over the held
       * alignments, which the view's ramps and key scale to
       */
      get attributeRanges(): Record<string, AttributeRange> {
        return featureAttributeRanges(self.features ?? [], this.channelNames)
      },
      /**
       * #getter
       * the colour channels the view's modes can paint: the preset
       * measurements and the columns the adapter declares
       */
      get channelNames() {
        return [...PRESET_ATTRIBUTES, ...declaredAttributes(self.adapterConfig)]
      },
      /**
       * #method
       * an alignment's two refNames with the circle's first genome's end
       * first, the order the view's `query` and `target` modes read them in
       */
      firstGenomeEnds(feature: Feature): readonly [string, string] {
        const [first] = self.trackAssemblyNames
        const mate = getMate(feature)
        const own: string = feature.get('refName')
        return !mate
          ? [own, own]
          : self.assemblyOf(
                feature.get('assemblyName') as string | undefined,
              ) === first
            ? [own, mate.refName]
            : [mate.refName, own]
      },
      /**
       * #getter
       * each alignment's packed colour under the view's `color`, by feature
       * id. A chromosome mode paints the ideogram colour of the chromosome it
       * joins, so a ribbon matches the arc it leaves; a label the view hides
       * paints at zero alpha
       */
      get ribbonColors(): Map<string, number> {
        const { view } = self
        const features = self.features ?? []
        const field = view.colorField
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
            f => this.firstGenomeEnds(f),
            this.channelNames,
          ),
          trackColor: view.trackColorFor(
            getContainingTrack(self).configuration.trackId,
          ),
          defaultColor: defaultAbgr(view.colorValue),
          nameColor: assembly
            ? name =>
                assembly.getRefNameColor(self.canonicalRefName(genome!, name))
            : undefined,
          attributeRanges: view.attributeRanges,
          hideUnlabelled: view.hideUnlabelled,
        })
        return new Map(features.map((f, i) => [f.id(), color(i)]))
      },
      /**
       * #getter
       * the resting fill of each ribbon, opaque: the ribbons share one
       * `ribbonOpacity`, so an opacity drag repaints no ribbon
       */
      get ribbonFill(): (feature: Feature) => string {
        const colors = this.ribbonColors
        return feature => opaqueHex(colors.get(feature.id()) ?? DEFAULT_ABGR)
      },
      /**
       * #getter
       * the fill opacity every resting ribbon draws at: the view's `alpha`,
       * times the alpha of a `color.value` every ribbon paints
       */
      get ribbonOpacity() {
        const { view } = self
        return view.colorField === ''
          ? (view.alpha * abgrAlpha(defaultAbgr(view.colorValue))) / 255
          : view.alpha
      },
      /**
       * #getter
       * what the ribbons draw: the visible alignments at least the view's
       * `minAlignmentLength` long on their own side, less those the view's
       * colour hides
       */
      get drawnFeatures(): Feature[] | undefined {
        const min = self.view.minAlignmentLength
        const colors = this.ribbonColors
        return self.visibleFeatures?.filter(
          f =>
            Math.abs(f.get('end') - f.get('start')) >= min &&
            abgrAlpha(colors.get(f.id()) ?? DEFAULT_ABGR) > 0,
        )
      },
      /**
       * #getter
       * `ribbonOpacity`, as the canvas reads it
       */
      get shapeAlpha() {
        return this.ribbonOpacity
      },
      /**
       * #getter
       * every held alignment's feet on the circle's unrolled axis, by the
       * feature's place in `features`: rebuilt by a fetch or a change to the
       * regions, never by a recolour, a zoom or a rotation
       */
      get ribbonFeet() {
        const features = self.features ?? []
        const n = features.length
        const feet = {
          x1: new Float32Array(n),
          x2: new Float32Array(n),
          y1: new Float32Array(n),
          y2: new Float32Array(n),
          xSlice: new Uint32Array(n),
          ySlice: new Uint32Array(n),
          strand: new Float32Array(n),
          placed: new Uint8Array(n),
          index: new Map<Feature, number>(),
        }
        features.forEach((feature, i) => {
          feet.index.set(feature, i)
          const mate = getMate(feature)
          const own = self.axisSlice(
            feature.get('assemblyName') as string | undefined,
            feature.get('refName'),
          )
          const other = mate
            ? self.axisSlice(mate.assemblyName, mate.refName)
            : undefined
          if (mate && own && other) {
            feet.placed[i] = 1
            feet.x1[i] = axisX(own, feature.get('start'))
            feet.x2[i] = axisX(own, feature.get('end'))
            feet.y1[i] = axisX(other, mate.start)
            feet.y2[i] = axisX(other, mate.end)
            feet.xSlice[i] = own.index
            feet.ySlice[i] = other.index
            feet.strand[i] = feature.get('strand') ?? 1
          }
        })
        return feet
      },
      /**
       * #getter
       * the drawn alignments as the ribbon mark's lanes, each in its fill with
       * the alpha the SV inspector's dimming leaves it
       */
      get ribbonLanes(): RibbonLanes {
        const feet = this.ribbonFeet
        const colors = this.ribbonColors
        const highlighted = self.highlightedFeatureIdSet
        const picked: number[] = []
        const features: Feature[] = []
        for (const feature of this.drawnFeatures ?? []) {
          const i = feet.index.get(feature)
          if (i !== undefined && feet.placed[i]) {
            picked.push(i)
            features.push(feature)
          }
        }
        const n = picked.length
        const lanes: RibbonLanes = {
          x1: new Float32Array(n),
          x2: new Float32Array(n),
          y1: new Float32Array(n),
          y2: new Float32Array(n),
          xSlice: new Uint32Array(n),
          ySlice: new Uint32Array(n),
          strand: new Float32Array(n),
          color: new Uint32Array(n),
          count: n,
          features,
        }
        picked.forEach((i, k) => {
          const id = features[k]!.id()
          lanes.x1[k] = feet.x1[i]!
          lanes.x2[k] = feet.x2[i]!
          lanes.y1[k] = feet.y1[i]!
          lanes.y2[k] = feet.y2[i]!
          lanes.xSlice[k] = feet.xSlice[i]!
          lanes.ySlice[k] = feet.ySlice[i]!
          lanes.strand[k] = feet.strand[i]!
          lanes.color[k] = withAbgrAlpha(
            colors.get(id) ?? DEFAULT_ABGR,
            highlighted?.has(id) === false ? DIMMED_ALPHA : 255,
          )
        })
        return lanes
      },
      /**
       * #getter
       */
      get drawnCount() {
        return this.ribbonLanes.count
      },
      /**
       * #getter
       * each drawn feature's place in the lanes, by id
       */
      get laneIndexById() {
        return new Map(this.ribbonLanes.features.map((f, i) => [f.id(), i]))
      },
      /**
       * #method
       * lane `i` as the SVG side draws it, on the unrotated figure
       */
      shapeAt(i: number): RibbonShape {
        const { ribbonLanes: lanes, ribbonFill } = this
        const feature = lanes.features[i]!
        return {
          kind: 'ribbon',
          feature,
          angles: ribbonAnglesAt(lanes, i, self.figureStage),
          fill: ribbonFill(feature),
        }
      },
      /**
       * #method
       */
      shapeFor(featureId: string) {
        const i = this.laneIndexById.get(featureId)
        return i === undefined ? undefined : this.shapeAt(i)
      },
      /**
       * #getter
       * every drawn alignment as the export draws it
       */
      get shapes(): RibbonShape[] {
        return this.ribbonLanes.features.map((_, i) => this.shapeAt(i))
      },
      /**
       * #method
       */
      shapeLabel(feature: Feature) {
        return ribbonLabel(feature)
      },
      /**
       * #method
       * a drawn feature's outline as an SVG path on the unrotated figure, for
       * anything that has to find a ribbon on screen without a DOM node to find
       */
      shapePathFor(feature: Feature) {
        const shape = this.shapeFor(feature.id())
        return shape
          ? shapePath(shape, self.radiusPx, self.bezierRadius)
          : undefined
      },
      /**
       * #getter
       * the ribbon fill the circle's key shows: the one colour every ribbon
       * paints when the view's mode keys nothing of its own
       */
      get legendColor(): string | undefined {
        const { view } = self
        return view.colorField === ''
          ? atAlpha(defaultAbgr(view.colorValue), view.alpha)
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
        for (const feature of self.features ?? []) {
          const mate = getMate(feature)
          const own = {
            refName: feature.get('refName'),
            start: feature.get('start'),
            end: feature.get('end'),
          }
          const ownAssembly = self.assemblyOf(
            feature.get('assemblyName') as string | undefined,
          )
          const mateAssembly = mate
            ? self.assemblyOf(mate.assemblyName)
            : undefined
          const [r, q] =
            ownAssembly === referenceAssembly &&
            mateAssembly === currentAssembly
              ? [own, mate]
              : ownAssembly === currentAssembly &&
                  mateAssembly === referenceAssembly
                ? [mate, own]
                : []
          if (r && q) {
            out.push({
              refRefName: self.canonicalRefName(referenceAssembly, r.refName),
              queryRefName: self.canonicalRefName(currentAssembly, q.refName),
              refStart: r.start,
              refEnd: r.end,
              queryStart: q.start,
              queryEnd: q.end,
              strand: feature.get('strand') ?? 1,
            })
          }
        }
        return out
      },
    }))
    .views(self => {
      const hitRibbon = ribbonHitTest()
      return {
        /**
         * #method
         * the alignment whose ribbon covers a point CSS px from the circle's
         * centre in the screen frame, the topmost where several do
         */
        hitAt(dx: number, dy: number) {
          if (self.displayPhase !== 'ready') {
            return undefined
          }
          const lanes = self.ribbonLanes
          const i = hitRibbon(lanes, self.chordStage, dx, dy)
          return i === undefined ? undefined : lanes.features[i]
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
    .views(self => ({
      /**
       * #method
       */
      async renderSvg(_opts: ExportSvgOptions & { theme?: ThemeOptions }) {
        const { renderSvg } = await import('./renderSvg.tsx')
        return renderSvg(self)
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
              regions,
            })
            // a ribbon draws no CIGAR, and a PIF's coarse tier is the same
            // rows with the CIGAR folded: a twentieth of the bytes on a chain
            return dedupeRibbons(
              await ctx.callRpc('CoreGetFeatures', {
                adapterConfig,
                regions: renamed,
                opts: { lodMode: 'coarse' },
              }),
            )
          },
        })
      },
    }))
}

export default stateModelFactory
