import { chooseDisplay } from '../../../../packages/core/src/util/displayChoice.ts'

import type {
  OfferedDisplay,
  ViewDisplay,
} from '../../../../packages/core/src/util/displayChoice.ts'
import type { TrackInfo } from './configs.ts'

// The core plugins' display registry as plain data, which
// scripts/generateConfigManifest.ts writes off a live PluginManager.
export interface DisplayTable {
  tracks: Record<string, OfferedDisplay[]>
  adapters: Record<string, string[]>
  // a retired display type name to the one that answers to it now
  displayAliases: Record<string, string>
  views: Record<
    string,
    {
      displays: ViewDisplay[]
      // the view type of each entry in its `views`, when it has rows
      rowType?: string
    }
  >
}

/**
 * The display a view of `viewType` opens a track as when nothing names one,
 * by the app's own `chooseDisplay`; undefined where a track, adapter, view or
 * declared display type outside the core plugins leaves it unknown. The
 * `Core-preProcessTrackConfig` handlers do not run here, and the generator
 * fails if that changes an answer for a track in `test_data/` or `demos/`.
 */
export function defaultDisplayIn(
  table: DisplayTable,
  track: Pick<TrackInfo, 'type' | 'adapterType' | 'declaredDisplayTypes'>,
  viewType: string,
) {
  const trackDisplays = table.tracks[track.type]
  const adapterCapabilities = table.adapters[track.adapterType]
  const view = table.views[viewType]
  const declared = track.declaredDisplayTypes.map(
    type => table.displayAliases[type] ?? type,
  )
  const core = new Set(
    Object.values(table.tracks).flatMap(displays => displays.map(d => d.name)),
  )
  return trackDisplays &&
    adapterCapabilities &&
    view &&
    declared.every(type => core.has(type))
    ? chooseDisplay({
        trackDisplays,
        adapterCapabilities,
        declaredDisplays: declared.map(type => ({ type })),
        viewType,
        viewDisplays: view.displays,
        requestedType: undefined,
      }).picked?.type
    : undefined
}
