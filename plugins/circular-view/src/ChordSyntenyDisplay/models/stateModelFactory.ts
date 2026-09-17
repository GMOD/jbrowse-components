import {
  ConfigurationReference,
  getConf,
  readConfObject,
  setConf,
} from '@jbrowse/core/configuration'
import { getSession, openFeatureWidget } from '@jbrowse/core/util'
import { colord } from '@jbrowse/core/util/colord'
import { isJexl } from '@jbrowse/core/util/jexlStrings'
import { types } from '@jbrowse/mobx-state-tree'
import {
  colorSchemes,
  getMate,
  renameRegionsForAdapter,
} from '@jbrowse/synteny-core'

import {
  BaseChordDisplay,
  installChordFetch,
} from '../../chords/BaseChordDisplay.ts'
import { dedupeRibbons } from '../../chords/dedupeRibbons.ts'
import { CHORD_COLOR_BY } from './configSchema.ts'

import type { ExportSvgOptions } from '../../CircularView/model.ts'
import type {
  ChordSyntenyDisplayConfigModel,
  RibbonColorBy,
} from './configSchema.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Feature } from '@jbrowse/core/util'
import type { AlignmentData } from '@jbrowse/core/util/diagonalizeRegions'
import type { ThemeOptions } from '@mui/material'

const RIBBON_ALPHA = 0.35

function translucent(color: string) {
  return colord(color).alpha(RIBBON_ALPHA).toRgbString()
}

function invert(map: Record<string, string>) {
  return Object.fromEntries(Object.entries(map).map(([k, v]) => [v, k]))
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
       * what a ribbon's hue says: the `color` config slot, the chromosome of
       * the circle's first genome it joins (that arc's ideogram color), or the
       * strand. The strand is also the twist in every mode
       */
      get colorBy(): RibbonColorBy {
        return getConf(self, 'colorBy')
      },
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
       * the ribbon fill the circle's key shows, when every ribbon shares one
       */
      get legendColor(): string | undefined {
        const value: unknown = self.configuration.color
        return self.colorBy === 'default' &&
          typeof value === 'string' &&
          !isJexl(value)
          ? value
          : undefined
      },
      /**
       * #getter
       * the resting fill of each ribbon under `colorBy`
       */
      get ribbonFill(): (feature: Feature) => string {
        const { configuration } = self
        const { colorBy } = this
        const configured = (feature: Feature) =>
          readConfObject(configuration, 'color', { feature })
        if (colorBy === 'strand') {
          const { posColor, negColor } = colorSchemes.strand
          const pos = translucent(posColor)
          const neg = translucent(negColor)
          return feature => (feature.get('strand') === -1 ? neg : pos)
        }
        const [first] = self.trackAssemblyNames
        const names =
          first === undefined ? undefined : self.adapterNames?.[first]
        if (colorBy !== 'chromosome' || first === undefined || !names) {
          return configured
        }
        const assembly = getSession(self).assemblyManager.get(first)
        const canonical = invert(names.refNameMap)
        return feature => {
          const mate = getMate(feature)
          const refName =
            mate && feature.get('assemblyName') !== names.assemblyName
              ? mate.refName
              : feature.get('refName')
          const color = assembly?.getRefNameColor(canonical[refName] ?? refName)
          return color ? translucent(color) : configured(feature)
        }
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
        const ref = self.adapterNames?.[referenceAssembly]
        const cur = self.adapterNames?.[currentAssembly]
        const out: AlignmentData[] = []
        if (!ref || !cur || !self.features) {
          return out
        }
        const refNames = invert(ref.refNameMap)
        const curNames = invert(cur.refNameMap)
        for (const feature of self.features) {
          const mate = getMate(feature)
          const own = {
            assemblyName: feature.get('assemblyName') as string,
            refName: feature.get('refName'),
            start: feature.get('start'),
            end: feature.get('end'),
          }
          const [r, q] =
            own.assemblyName === ref.assemblyName &&
            mate?.assemblyName === cur.assemblyName
              ? [own, mate]
              : own.assemblyName === cur.assemblyName &&
                  mate?.assemblyName === ref.assemblyName
                ? [mate, own]
                : []
          if (r && q) {
            out.push({
              refRefName: refNames[r.refName] ?? r.refName,
              queryRefName: curNames[q.refName] ?? q.refName,
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
        setColorBy(colorBy: RibbonColorBy) {
          setConf(self, 'colorBy', colorBy)
        },
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
      trackMenuItems(): MenuItem[] {
        return [
          {
            label: 'Color by',
            type: 'subMenu',
            subMenu: CHORD_COLOR_BY.map(({ value, label }) => ({
              label,
              type: 'radio' as const,
              checked: self.colorBy === value,
              onClick: () => {
                self.setColorBy(value)
              },
            })),
          },
        ]
      },
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
