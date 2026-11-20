import type { HierarchicalTrackSelectorModel } from '../../model.ts'

/**
 * A track label's click handler: Ctrl/Cmd-click adds the track to the
 * selection or takes it out, and stops the label toggling its checkbox
 */
export function selectOnModifierClick(
  model: HierarchicalTrackSelectorModel,
  trackId: string,
) {
  return (event: React.MouseEvent) => {
    if (event.ctrlKey || event.metaKey) {
      if (model.isSelected(trackId)) {
        model.removeFromSelection([trackId])
      } else {
        model.addToSelection([trackId])
      }
      event.preventDefault()
    }
  }
}
