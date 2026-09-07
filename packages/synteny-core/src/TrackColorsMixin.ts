import { types } from '@jbrowse/mobx-state-tree'

import { continuousRampConfig, isAttributeLabels } from './colorRamps.ts'
import { coerceColorBy, colorByAttributeName } from './colorUtils.ts'
import { assignTrackColors, syntenyTrackPalette } from './trackColors.ts'

import type { ColorChip } from './colorLegend.ts'
import type { AttributeRange } from './colorRamps.ts'
import type { SyntenyColorBy } from './colorUtils.ts'
import type { ColorableTrack } from './trackColors.ts'

// A label list only ever gains labels, in the order they were first seen, and
// a label's file color is whichever was seen first. A text column meeting a
// span from an earlier fetch takes over: the column is categorical.
function widenOne(prev: AttributeRange, range: AttributeRange) {
  if (isAttributeLabels(range)) {
    const prevLabels = isAttributeLabels(prev) ? prev : undefined
    const seen = new Set(prevLabels?.labels)
    const added = range.labels.filter(l => !seen.has(l))
    const newColors = Object.entries(range.colors).filter(
      ([l]) => prevLabels?.colors[l] === undefined,
    )
    return prevLabels && added.length === 0 && newColors.length === 0
      ? undefined
      : {
          labels: [...(prevLabels?.labels ?? []), ...added],
          colors: {
            ...prevLabels?.colors,
            ...Object.fromEntries(newColors),
          },
        }
  }
  return isAttributeLabels(prev)
    ? undefined
    : range.min < prev.min || range.max > prev.max
      ? {
          min: Math.min(prev.min, range.min),
          max: Math.max(prev.max, range.max),
        }
      : undefined
}

// Widen `into` by `ranges`, returning `into` ITSELF when nothing moved: this is
// read through a computed on every recolor, and a fresh object per fetch that
// told it nothing new would re-run every downstream color pass.
export function widenAttributeRanges(
  into: Record<string, AttributeRange>,
  ranges: Record<string, AttributeRange>,
) {
  const grown = Object.entries(ranges).flatMap(([name, range]) => {
    const prev = into[name]
    const next = prev ? widenOne(prev, range) : range
    return next ? ([[name, next]] as const) : []
  })
  return grown.length === 0 ? into : { ...into, ...Object.fromEntries(grown) }
}

/**
 * #stateModel TrackColorsMixin
 *
 * The color-by state shared by every view that can draw more than one synteny
 * track at once: the view-wide mode and the palette that tells overlaid tracks
 * apart.
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
       * The color-by mode every track in the view renders with.
       */
      colorBy: types.stripDefault(types.string, 'default'),
      /**
       * #property
       * trackId -> explicit color under `colorBy: 'track'`. Absent means the
       * track takes an automatic slot from the palette.
       */
      trackColors: types.map(types.string),
      /**
       * #property
       * Under a text-column mode, draw only the rows that carry a label.
       */
      hideUnlabelled: types.stripDefault(types.boolean, false),
    })
    .volatile(() => ({
      /**
       * #volatile
       * The mode whose legend the reader closed. The legend comes back with the
       * next mode that has one, so a dismissal is scoped to the mode it was
       * made in rather than being a setting to find again.
       */
      colorLegendDismissedFor: undefined as string | undefined,
      /**
       * #volatile
       * The widest span each numeric channel has been seen to cover, over every
       * fetch this view has taken — what keeps an `attribute:<column>` ramp from
       * re-scaling under a pan. Widened by `observeAttributeRanges`, dropped by
       * `resetAttributeRanges`, read through `attributeRanges`, which is where
       * the reasoning is.
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
       * Columns the overlaid tracks declare (an ortholog table's
       * `attributeColumns`), each of which the palette menu offers as its own
       * mode, less the reserved `color` column. Overridden by the composing
       * view, which is the only thing that can reach the track configs.
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
       * Monotonic UNTIL A MODE IS PICKED, which is the way back: one window
       * holding an outlier would otherwise compress the ramp for the rest of the
       * session, and the union above is over the LOADED spans, so
       * `resetAttributeRanges` rescales to what is on screen there and then.
       *
       * View-wide rather than per display because the floating legend is one box
       * for the whole view: two displays scaling the same ramp from different
       * spans would make that one legend lie about one of them.
       */
      get attributeRanges(): Record<string, AttributeRange> {
        return self
          .loadedAttributeRanges()
          .reduce(widenAttributeRanges, self.seenAttributeRanges)
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
       * #getter
       * `colorBy` coerced to a mode the renderers know, since the property is a
       * plain string for snapshot-compat.
       */
      get colorByMode(): SyntenyColorBy {
        return coerceColorBy(self.colorBy)
      },
      /**
       * #getter
       * Whether the floating legend is up: the mode has a key worth drawing — a
       * ramp, a label per track, a chip per category — and the reader has not
       * closed it for this mode. Default and strand are read without one, and
       * the by-chromosome modes have no fixed key to show.
       */
      get showColorLegend(): boolean {
        const mode = this.colorByMode
        const hasKey =
          mode === 'track' ||
          mode in continuousRampConfig ||
          colorByAttributeName(mode) !== undefined
        return hasKey && self.colorLegendDismissedFor !== mode
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
       * Legend rows naming the overlaid tracks — one per track with its palette
       * color, and only under `colorBy: 'track'`, since every other mode has a
       * fixed legend of its own.
       */
      get colorLegendChips(): ColorChip[] {
        return self.colorByMode === 'track'
          ? self.colorableTracks.map(t => ({
              color: this.trackColorFor(t.trackId),
              label: t.name,
            }))
          : []
      },
    }))
    .actions(self => {
      // Identity-preserving, like `widenAttributeRanges`: a recolor reads the domain
      // through a computed, and a fresh empty object per mode pick would re-run
      // every color pass behind a reset that reset nothing.
      function forgetSeenRanges() {
        if (Object.keys(self.seenAttributeRanges).length > 0) {
          self.seenAttributeRanges = {}
        }
      }
      return {
        /**
         * #action
         * Fold one fetch's observed attribute spans into the domain this view
         * paints and labels its ramps with. Called by each display as its fetch
         * lands, because the accumulation has to outlive the payload it came
         * from: the previous window's span is gone from `loadedAttributeRanges`
         * the moment the next one commits.
         */
        observeAttributeRanges(ranges: Record<string, AttributeRange>) {
          self.seenAttributeRanges = widenAttributeRanges(
            self.seenAttributeRanges,
            ranges,
          )
        },
        /**
         * #action
         * Forget the accumulated domain, leaving `attributeRanges` reporting
         * what the LOADED fetches cover and nothing else.
         *
         * The way back from a monotonic domain, and the only one: a single
         * window holding an outlier widens the ramp for the rest of the
         * session, and `attributeRanges` unions the loaded spans over this, so
         * a reset rescales to what is on screen without waiting for a refetch.
         * Picking a mode is what calls it — the gesture a reader makes when the
         * ramp is telling them nothing is to choose it again.
         */
        resetAttributeRanges() {
          forgetSeenRanges()
        },
        /**
         * #action
         * Set the view-wide mode, and rescale the ramp, which is the only way
         * back from a domain one outlying window widened.
         */
        /**
         * #action
         */
        setHideUnlabelled(value: boolean) {
          self.hideUnlabelled = value
        },
        /**
         * #action
         */
        setColorBy(value: SyntenyColorBy) {
          self.colorBy = value
          forgetSeenRanges()
        },
        /**
         * #action
         * Pin one track's color under `colorBy: 'track'`, or release it back to
         * an automatic palette slot.
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
        clearTrackColors() {
          self.trackColors.clear()
        },
        /**
         * #action
         * Close the legend for the mode in use.
         */
        dismissColorLegend() {
          self.colorLegendDismissedFor = self.colorByMode
        },
      }
    })
}
