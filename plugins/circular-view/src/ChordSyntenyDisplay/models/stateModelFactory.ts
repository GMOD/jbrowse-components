import { ConfigurationReference } from '@jbrowse/core/configuration'
import {
  getContainingTrack,
  getSession,
  openFeatureWidget,
} from '@jbrowse/core/util'
import {
  abgrAlpha,
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
import { dedupeRibbons } from '../../chords/dedupeRibbons.ts'

import type { ExportSvgOptions } from '../../CircularView/model.ts'
import type { ChordSyntenyDisplayConfigModel } from './configSchema.ts'
import type { Feature } from '@jbrowse/core/util'
import type { AlignmentData } from '@jbrowse/core/util/diagonalizeRegions'
import type { AttributeRange } from '@jbrowse/synteny-core'
import type { ThemeOptions } from '@mui/material'

// what a ribbon paints under the view's default mode, at the view's `alpha`
const DEFAULT_RIBBON_COLOR = 'rgb(70,130,180)'

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
       * each alignment's resting fill under the view's `colorBy` and `alpha`,
       * by feature id. A chromosome mode paints the ideogram colour of the
       * chromosome it joins, so a ribbon matches the arc it leaves
       */
      get ribbonColors(): Map<string, string> {
        const { view } = self
        const features = self.features ?? []
        const field = view.colorByField
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
          defaultColor: cssColorToABGR(
            view.colorByValue ?? DEFAULT_RIBBON_COLOR,
          ),
          nameColor: assembly
            ? name =>
                assembly.getRefNameColor(self.canonicalRefName(genome!, name))
            : undefined,
          attributeRanges: view.attributeRanges,
          hideUnlabelled: view.hideUnlabelled,
        })
        return new Map(
          features.map((f, i) => [f.id(), atAlpha(color(i), view.alpha)]),
        )
      },
      /**
       * #getter
       * the resting fill of each ribbon
       */
      get ribbonFill(): (feature: Feature) => string {
        const colors = this.ribbonColors
        return feature => colors.get(feature.id()) ?? DEFAULT_RIBBON_COLOR
      },
      /**
       * #getter
       * what the ribbons draw: the visible alignments at least the view's
       * `minAlignmentLength` long on their own side
       */
      get drawnFeatures(): Feature[] | undefined {
        const min = self.view.minAlignmentLength
        return min > 0
          ? self.visibleFeatures?.filter(
              f => Math.abs(f.get('end') - f.get('start')) >= min,
            )
          : self.visibleFeatures
      },
      /**
       * #getter
       * the ribbon fill the circle's key shows: the one colour every ribbon
       * paints when the view's mode keys nothing of its own
       */
      get legendColor(): string | undefined {
        const { view } = self
        return view.colorByField === ''
          ? atAlpha(
              cssColorToABGR(view.colorByValue ?? DEFAULT_RIBBON_COLOR),
              view.alpha,
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
    .actions(self => {
      const superReload = self.reload
      return {
        /**
         * #action
         */
        onRibbonClick(feature: Feature) {
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
            return dedupeRibbons(
              await ctx.callRpc('CoreGetFeatures', {
                adapterConfig,
                regions: renamed,
              }),
            )
          },
        })
      },
    }))
}

export default stateModelFactory
