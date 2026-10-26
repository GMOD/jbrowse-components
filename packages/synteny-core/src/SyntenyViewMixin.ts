import { readConfObject, setConf } from '@jbrowse/core/configuration'
import { legendSpecOf } from '@jbrowse/core/ui/colorScale'
import { legendConfigSchema } from '@jbrowse/display-kit/legendConfigSchema'
import { cast, getSnapshot, types } from '@jbrowse/mobx-state-tree'

import { SyntenyColorsMixin } from './SyntenyColorsMixin.ts'
import { trackHasLodTiers } from './lodTier.ts'
import { syntenyDataConfigSchema } from './syntenyDataConfigSchema.ts'

import type { LodMode } from './lodTier.ts'
import type { LegendSpec } from '@jbrowse/core/ui/legendSpec'

/**
 * #stateModel SyntenyViewMixin
 *
 * What the linear synteny and dotplot views share beyond `SyntenyColorsMixin`:
 * the level-of-detail tier every track draws at, and a color key the reader
 * closes per mode.
 */
export function SyntenyViewMixin({
  defaultOpacity,
}: {
  defaultOpacity: number
}) {
  return types
    .compose(
      'SyntenyViewMixin',
      SyntenyColorsMixin({ defaultOpacity }),
      types.model({
        /**
         * #property
         * What the fetch reads, a [](/docs/config/syntenydata) object:
         * `resolution` picks a tiered file's stored tier. One value for the
         * view, so every track draws at the same tier.
         */
        data: types.stripDefault(syntenyDataConfigSchema, {}),
        /**
         * #property
         * Whether the view draws its color key, a [](/docs/config/legend)
         * object. The key's close button hides it for the current mode only
         * and is never saved.
         */
        legend: types.stripDefault(legendConfigSchema, {}),
      }),
    )
    .volatile(() => ({
      /**
       * #volatile
       * The field whose legend the reader closed. The legend comes back with
       * the next field that has one, so a dismissal is scoped to the field it
       * was made in rather than being a setting to find again.
       */
      colorLegendDismissedFor: undefined as string | undefined,
    }))
    .views(self => ({
      /**
       * #getter
       * Whether any track's adapter has tiers to switch between, which gates
       * the "Level of detail" setting.
       */
      get hasLodCapableAdapter() {
        return self.syntenyTracks().some(trackHasLodTiers)
      },
      /**
       * #getter
       * `data.resolution`: the stored tier every track fetches.
       */
      get resolution(): LodMode {
        return readConfObject(self.data, 'resolution')
      },
      /**
       * #getter
       * The legend-host half of `LegendMixin` a view needs: whether the key
       * draws, which is `legend.show`, the mode having a key, and the reader
       * not having closed it in this mode. `ChromeLegend` and `SvgLegend`
       * read it.
       */
      get showLegend(): boolean {
        return (
          readConfObject(self.legend, 'show') &&
          self.hasLegendKey &&
          self.colorLegendDismissedFor !== self.colorField
        )
      },
      /**
       * #getter
       * The key `ChromeLegend` draws on screen and `SvgLegend` in the export.
       */
      get legendSpec(): LegendSpec {
        return legendSpecOf(self.colorScales)
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setResolution(resolution: LodMode) {
        self.data = cast({ ...getSnapshot(self.data), resolution })
      },
      /**
       * #action
       * The legend host's setter: closing the key hides it for this mode
       * only, so picking another mode brings its key up.
       */
      setShowLegend(show: boolean) {
        self.colorLegendDismissedFor = show ? undefined : self.colorField
      },
      /**
       * #action
       * The "Show legend" checkbox: writes `legend.show`, and showing it
       * brings back a key closed in this mode.
       */
      setLegendShow(show: boolean) {
        setConf(self.legend, 'show', show)
        if (show) {
          self.colorLegendDismissedFor = undefined
        }
      },
      /**
       * #action
       * One section is the whole key here.
       */
      dismissLegendSection() {
        self.colorLegendDismissedFor = self.colorField
      },
    }))
}
