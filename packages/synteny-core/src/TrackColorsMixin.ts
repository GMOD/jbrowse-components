import { types } from '@jbrowse/mobx-state-tree'

import { trackLegendChips } from './colorLegend.ts'
import { coerceColorBy } from './colorUtils.ts'
import { assignTrackColors, syntenyTrackPalette } from './trackColors.ts'

import type { ColorChip } from './colorLegend.ts'
import type { AttributeRange } from './colorRamps.ts'
import type { SyntenyColorBy } from './colorUtils.ts'
import type { ColorableTrack } from './trackColors.ts'

// Widen `into` by `ranges`, returning `into` ITSELF when nothing moved: this is
// read through a computed on every recolor, and a fresh object per fetch that
// told it nothing new would re-run every downstream color pass.
function widenRanges(
  into: Record<string, AttributeRange>,
  ranges: Record<string, AttributeRange>,
) {
  const grown = Object.entries(ranges).flatMap(([name, range]) => {
    const prev = into[name]
    return prev
      ? range.min < prev.min || range.max > prev.max
        ? ([
            [
              name,
              {
                min: Math.min(prev.min, range.min),
                max: Math.max(prev.max, range.max),
              },
            ],
          ] as const)
        : []
      : ([[name, range]] as const)
  })
  return grown.length === 0 ? into : { ...into, ...Object.fromEntries(grown) }
}

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
    .volatile(() => ({
      /**
       * #volatile
       * The widest span each numeric channel has been seen to cover, over every
       * fetch this view has taken — what keeps an `attribute:<column>` ramp from
       * re-scaling under a pan. Widened by `observeAttributeRanges`, read
       * through `attributeRanges`, which is where the reasoning is.
       */
      seenAttributeRanges: {} as Record<string, AttributeRange>,
    }))
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
      /**
       * #method
       * Numeric columns the overlaid tracks declare (an ortholog table's
       * `attributeColumns`), each of which the palette menu offers as its own
       * mode. Overridden by the composing view, which is the only thing that
       * can reach the track configs.
       *
       * From the CONFIG rather than from loaded data: the menu has to be right
       * before the first fetch, and a track that declares a column carrying no
       * values paints the default color anyway.
       */
      colorableAttributeNames(): string[] {
        return []
      },
      /**
       * #method
       * One entry per loaded display: the span each numeric channel actually
       * covered in the data that display fetched. Overridden by the composing
       * view, which is the only thing that can reach the displays.
       *
       * From loaded DATA rather than from the config, unlike
       * `colorableAttributeNames` — a column's observed span is not declared
       * anywhere, so nothing before the first fetch can answer it.
       */
      loadedAttributeRanges(): Record<string, AttributeRange>[] {
        return []
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Distinct numeric columns across the overlaid tracks, in first-seen
       * order — two tracks declaring `dn` offer one `dn` mode, not two.
       */
      get colorableAttributes(): string[] {
        return [...new Set(self.colorableAttributeNames())]
      },
      /**
       * #getter
       * The span each numeric channel covers: unioned over the loaded displays,
       * and over every fetch this view has already taken (`seenAttributeRanges`).
       * An `attribute:<column>` mode has no declared domain, so this is what its
       * ramp scales to, what the legend labels it with, and — since it is the
       * one domain — what the two cannot disagree about.
       *
       * MONOTONIC, which is the point. A fetch's payload reports the span of the
       * slice it holds, and that slice is the snapped window: painting straight
       * off it re-maps every feature onto the ramp each time a pan rolls the
       * window over, so a ribbon in the middle of the ramp turns into one at the
       * bottom while the reader is scrolling and its value has not changed. A
       * domain that only ever widens still says what the reader is looking at —
       * the legend prints the actual numbers — and settles instead of
       * oscillating.
       *
       * View-wide rather than per display because the floating legend is one box
       * for the whole view: two displays scaling the same ramp from different
       * spans would make that one legend lie about one of them.
       */
      get attributeRanges(): Record<string, AttributeRange> {
        return self
          .loadedAttributeRanges()
          .reduce(widenRanges, self.seenAttributeRanges)
      },
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
       * Fold one fetch's observed attribute spans into the domain this view
       * paints and labels its ramps with. Called by each display as its fetch
       * lands, because the accumulation has to outlive the payload it came from:
       * the previous window's span is gone from `loadedAttributeRanges` the
       * moment the next one commits.
       */
      observeAttributeRanges(ranges: Record<string, AttributeRange>) {
        self.seenAttributeRanges = widenRanges(self.seenAttributeRanges, ranges)
      },
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
