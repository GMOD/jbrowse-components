import { selectorMatchesModel } from './extensionSelectors.ts'

import type PluginManager from '../PluginManager.ts'
import type { FeaturePanelProps } from '../PluginManager.ts'
import type { TrackSelectorFields } from './extensionSelectors.ts'
import type { ComponentType } from 'react'

/**
 * Which feature detail widgets a panel is added to. Every field given must
 * match, and an empty selector adds the panel to every track's feature details.
 * There is no `widgetType`: a feature detail widget's type varies by track
 * type, so `trackType` is the field that means "my kind of track".
 */
// #region selector
export interface FeaturePanelSelector extends TrackSelectorFields {
  /** escape hatch; also has the `feature` being shown */
  where?: (props: FeaturePanelProps) => boolean
}
// #endregion

/**
 * Add a panel to the feature details widget of the tracks the selector matches.
 * The panel renders its own card chrome (`BaseCard` for a titled section) and
 * appears after the built-in sections, in registration order among other
 * plugins' panels.
 *
 * Prefer this to calling `addToExtensionPoint('Core-extraFeaturePanel', ...)`
 * directly. The point fires for every feature detail widget, so a hand-written
 * callback both appends to the accumulated array and re-derives its own
 * scoping; forgetting to spread the array drops every other plugin's panel, and
 * scoping by `model.trackId ===` stops applying as soon as the user copies the
 * track.
 */
export function addFeaturePanel(
  pluginManager: PluginManager,
  {
    select,
    panel,
  }: {
    select?: FeaturePanelSelector
    panel: ComponentType<FeaturePanelProps>
  },
) {
  pluginManager.addToExtensionPoint(
    'Core-extraFeaturePanel',
    (panels, props) =>
      selectorMatchesModel(select, props.model) &&
      (select?.where === undefined || select.where(props))
        ? [...panels, panel]
        : panels,
  )
}
