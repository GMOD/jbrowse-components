import { types } from '@jbrowse/mobx-state-tree'

import { trackLegendChips } from './colorLegend.ts'
import { coerceColorBy } from './colorUtils.ts'
import { assignTrackColors, syntenyTrackPalette } from './trackColors.ts'

import type { ColorChip } from './colorLegend.ts'
import type { SyntenyColorBy } from './colorUtils.ts'
import type { ColorableTrack } from './trackColors.ts'

/**
 * #stateModel TrackColorsMixin
 *
 * The color-by state shared by every view that can draw more than one synteny
 * track at once: the view-wide mode, the per-track overrides, and the palette
 * that tells overlaid tracks apart.
 *
 * A view supplies only `colorableTrackConfigs` — the dotplot walks its flat
 * `tracks`, a linear synteny view flattens `levels`. Everything downstream of
 * that list (palette assignment, mode resolution, legend rows) is identical, so
 * it lives here rather than being copied into both models.
 */
export function TrackColorsMixin() {
  return types
    .model({
      /**
       * #property
       * The color-by mode the whole view renders with, unless a track overrides
       * it in `trackColorBy`.
       */
      colorBy: types.stripDefault(types.string, 'default'),
      /**
       * #property
       * trackId -> color-by mode for that track alone. Absent means the track
       * follows the view-wide `colorBy`.
       */
      trackColorBy: types.map(types.string),
      /**
       * #property
       * trackId -> explicit color under `colorBy: 'track'`. Absent means the
       * track takes an automatic slot from the palette.
       */
      trackColors: types.map(types.string),
      /**
       * #property
       * Show the floating color-by legend. Dismissible via the legend's close
       * button; re-enable from the color-by (palette) menu.
       */
      showColorLegend: types.stripDefault(types.boolean, false),
    })
    .views(() => ({
      /**
       * #method
       * The tracks that can take a palette slot, in paint order. Overridden by
       * the composing view; a method rather than a getter because that is the
       * form MST overrides cleanly.
       */
      colorableTrackConfigs(): { trackId: string; name: string }[] {
        return []
      },
    }))
    .views(self => ({
      /**
       * #getter
       * `colorableTrackConfigs` paired with whatever color the user pinned.
       * This is the single definition of "the tracks that get colors" — the
       * palette, the legend and the palette menu all read it, so they cannot
       * disagree about which tracks are in play.
       */
      get colorableTracks(): ColorableTrack[] {
        return self.colorableTrackConfigs().map(({ trackId, name }) => ({
          trackId,
          name,
          color: self.trackColors.get(trackId),
        }))
      },
    }))
    .views(self => ({
      /**
       * #getter
       * trackId -> the color it draws in under `colorBy: 'track'`. Assigned
       * across the whole view rather than per display, so an automatic slot
       * can't duplicate a color pinned on a sibling.
       */
      get trackColorAssignments(): Map<string, string> {
        return assignTrackColors(self.colorableTracks)
      },
      /**
       * #method
       * The mode one track renders with: its own override, else the view-wide
       * mode.
       */
      resolveColorBy(trackId: string): SyntenyColorBy {
        return coerceColorBy(self.trackColorBy.get(trackId) ?? self.colorBy)
      },
    }))
    .views(self => ({
      /**
       * #method
       */
      trackColorFor(trackId: string): string {
        const assigned = self.trackColorAssignments.get(trackId)
        // a display always belongs to a track in the list; the fallback only
        // covers a display read mid-teardown, where any color will do
        return assigned === undefined ? syntenyTrackPalette[0]! : assigned
      },
      /**
       * #getter
       * The mode to report as "the view's mode" — undefined when tracks
       * disagree, so the menu shows nothing checked and the legend says so
       * instead of picking one track's answer for everyone.
       */
      get uniformColorBy(): SyntenyColorBy | undefined {
        const [first, ...rest] = [
          ...new Set(
            self.colorableTracks.map(t => self.resolveColorBy(t.trackId)),
          ),
        ]
        if (rest.length > 0) {
          return undefined
        }
        // no tracks yet: the view-wide mode is the only answer there is
        return first === undefined ? coerceColorBy(self.colorBy) : first
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Legend rows naming the overlaid tracks — non-empty only when they are
       * colored by track, or by different modes.
       */
      get colorLegendChips(): ColorChip[] {
        return trackLegendChips(
          self.colorableTracks.map(t => ({
            name: t.name,
            colorBy: self.resolveColorBy(t.trackId),
            trackColor: self.trackColorFor(t.trackId),
          })),
          self.uniformColorBy,
        )
      },
    }))
    .actions(self => ({
      /**
       * #action
       * Set the view-wide mode. Clears every per-track override, so picking a
       * mode from the top level of the palette menu really does mean "all
       * tracks".
       */
      setColorBy(value: SyntenyColorBy) {
        self.colorBy = value
        self.trackColorBy.clear()
      },
      /**
       * #action
       * Point one track at its own mode, or back at the view-wide one.
       */
      setTrackColorBy(trackId: string, value: SyntenyColorBy | undefined) {
        if (value === undefined) {
          self.trackColorBy.delete(trackId)
        } else {
          self.trackColorBy.set(trackId, value)
        }
      },
      /**
       * #action
       * Pin one track's color under `colorBy: 'track'`, or release it back to an
       * automatic palette slot.
       */
      setTrackColor(trackId: string, value: string | undefined) {
        if (value === undefined) {
          self.trackColors.delete(trackId)
        } else {
          self.trackColors.set(trackId, value)
        }
      },
      /**
       * #action
       */
      clearTrackColorSettings() {
        self.trackColorBy.clear()
        self.trackColors.clear()
      },
      /**
       * #action
       */
      setShowColorLegend(value: boolean) {
        self.showColorLegend = value
      },
    }))
}
