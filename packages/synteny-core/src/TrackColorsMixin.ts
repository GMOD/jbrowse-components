import { readConfObject } from '@jbrowse/core/configuration'
import { legendSpecOf } from '@jbrowse/core/ui/colorScale'
import { coarseStripHTML } from '@jbrowse/core/util'
import { groupKeyComparator } from '@jbrowse/core/util/groupKeys'
import { cast, types } from '@jbrowse/mobx-state-tree'

import { colorByScales } from './colorLegend.ts'
import { isAttributeLabels, presetRamp } from './colorRamps.ts'
import { paintedField, syntenyColorFor } from './syntenyColorBy.ts'
import {
  SYNTENY_VIEW_FIELDS,
  syntenyColorConfigSchema,
} from './syntenyColorConfigSchema.ts'
import { assignTrackColors, syntenyTrackPalette } from './trackColors.ts'

import type { CigarOpMask, ColorChip } from './colorLegend.ts'
import type { AttributeRange } from './colorRamps.ts'
import type { SyntenyColorSnapshot } from './syntenyColorConfigSchema.ts'
import type { ColorableTrack } from './trackColors.ts'
import type { ColorScale } from '@jbrowse/core/ui/colorScale'
import type { LegendSpec } from '@jbrowse/core/ui/legendSpec'

const STRUCTURAL_FIELDS: ReadonlySet<string> = new Set(SYNTENY_VIEW_FIELDS)

function isColumnField(field: string) {
  return (
    field !== '' &&
    !STRUCTURAL_FIELDS.has(field) &&
    presetRamp(field) === undefined
  )
}

// A label list only ever gains labels, in the order they were first seen, and
// a label's file color is whichever was seen first; a row with no value, once
// seen, stays in the key the same way. A text column meeting a span from an
// earlier fetch takes over: the column is categorical.
function widenOne(prev: AttributeRange, range: AttributeRange) {
  if (isAttributeLabels(range)) {
    const prevLabels = isAttributeLabels(prev) ? prev : undefined
    const seen = new Set(prevLabels?.labels)
    const added = range.labels.filter(l => !seen.has(l))
    const newColors = Object.entries(range.colors).filter(
      ([l]) => prevLabels?.colors[l] === undefined,
    )
    const missing = !!(prevLabels?.missing || range.missing)
    return prevLabels &&
      added.length === 0 &&
      newColors.length === 0 &&
      missing === !!prevLabels.missing
      ? undefined
      : {
          labels: [...(prevLabels?.labels ?? []), ...added],
          colors: {
            ...prevLabels?.colors,
            ...Object.fromEntries(newColors),
          },
          ...(missing ? { missing } : {}),
        }
  }
  if (isAttributeLabels(prev)) {
    return undefined
  }
  const missing = !!(prev.missing || range.missing)
  return range.min < prev.min ||
    range.max > prev.max ||
    missing !== !!prev.missing
    ? {
        min: Math.min(prev.min, range.min),
        max: Math.max(prev.max, range.max),
        ...(missing ? { missing } : {}),
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

// The declared domain, applied at the read rather than to the accumulation:
// `widenOne` above stays first-seen, so clearing the domain gives back the
// order the fetches found. Each label range carries the domain, which also
// decides its colors. Identity-preserving like `widenAttributeRanges`, and for
// the same reason.
export function orderAttributeLabels(
  ranges: Record<string, AttributeRange>,
  domain: readonly string[],
) {
  if (domain.length === 0) {
    return ranges
  }
  const compare = groupKeyComparator(domain)
  const moved = Object.entries(ranges).flatMap(([name, range]) => {
    if (!isAttributeLabels(range)) {
      return []
    }
    const labels = [...range.labels].sort(compare)
    return labels.every((label, i) => label === range.labels[i]) &&
      range.domain?.join('\u001F') === domain.join('\u001F')
      ? []
      : ([[name, { ...range, labels, domain }]] as const)
  })
  return moved.length === 0
    ? ranges
    : { ...ranges, ...Object.fromEntries(moved) }
}

/**
 * #stateModel TrackColorsMixin
 *
 * The color-by state shared by every view that can draw more than one synteny
 * track at once: the view-wide colour object and the palette that tells overlaid tracks
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
       * The colour every track in the view paints with, a
       * [](/docs/config/syntenycolor) object: `{ field: "strand" }`,
       * `{ field: "query" }`, `{ field: "reference" }`, `{ field: "track" }`,
       * a measurement (`identity`, `mappingQual`, `dnds`) or a column the
       * tracks declare, with `domain` ordering a text column's labels; a
       * colour string paints every alignment. Unset, the default scheme
       * paints.
       */
      colorBy: syntenyColorConfigSchema,
      /**
       * #property
       * trackId -> explicit color under `colorBy: { field: 'track' }`. Absent
       * means the track takes an automatic slot from the palette.
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
       * The field whose legend the reader closed. The legend comes back with
       * the next field that has one, so a dismissal is scoped to the field it
       * was made in rather than being a setting to find again.
       */
      colorLegendDismissedFor: undefined as string | undefined,
      /**
       * #volatile
       * The widest span each numeric channel has been seen to cover, over every
       * fetch this view has taken — what keeps a column's ramp from
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
      /**
       * #method
       * Overridable hook: what the key's chips are composited by. The ribbon
       * views draw at a global alpha over the band's ground; a view that draws
       * opaque leaves it.
       */
      legendAlpha(): number {
        return 1
      },
      /**
       * #method
       * Overridable hook: the indel ops the key lists a chip for, so it names
       * only what the eye can find. `undefined` is the static menu preview;
       * the dotplot draws flat points and never a CIGAR op.
       */
      legendCigarOps(): CigarOpMask | undefined {
        return undefined
      },
      /**
       * #method
       * Overridable hook: whether the view draws each alignment as one flat
       * point (the dotplot) rather than a ribbon with match and indel blocks.
       */
      legendPointBased(): boolean {
        return false
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The `colorBy` object as its snapshot holds it.
       */
      get colorBySetting(): SyntenyColorSnapshot {
        return {
          value: readConfObject(self.colorBy, 'value'),
          field: readConfObject(self.colorBy, 'field'),
          scale: readConfObject(self.colorBy, 'scale'),
          domain: readConfObject(self.colorBy, 'domain'),
        }
      },
      /**
       * #getter
       * `colorBy.value`: the colour every alignment paints under the default
       * mode in place of the view's own scheme, or undefined for that scheme.
       */
      get colorByValue(): string | undefined {
        return this.colorBySetting.value
      },
      /**
       * #getter
       * `colorBy.domain`, the order a text column's labels take.
       */
      get colorDomain(): readonly string[] {
        return this.colorBySetting.domain ?? []
      },
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
       * A column has no declared domain, so this is what its
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
        const widened = self
          .loadedAttributeRanges()
          .reduce(widenAttributeRanges, self.seenAttributeRanges)
        return orderAttributeLabels(widened, this.colorDomain)
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
          name: coarseStripHTML(name),
          color: self.trackColors.get(trackId),
        }))
      },
    }))
    .views(self => ({
      /**
       * #getter
       * trackId -> the color it draws in under `colorBy: { field: 'track' }`.
       * Assigned across the whole view rather than per display, so an automatic slot
       * can't duplicate a color pinned on a sibling.
       */
      get trackColorAssignments(): Map<string, string> {
        return assignTrackColors(self.colorableTracks)
      },
      /**
       * #getter
       * The field `colorBy` paints by, `''` for the default colour.
       */
      get colorByField(): string {
        return paintedField(self.colorBySetting)
      },
      /**
       * #getter
       * Whether the floating legend is up: the mode has a key worth drawing — a
       * ramp, a label per track, a chip per category — and the reader has not
       * closed it for this mode. Default and strand are read without one, and
       * the by-chromosome modes have no fixed key to show.
       */
      /**
       * #getter
       * Whether the mode has a key worth a box: a track palette, a ramp, or
       * a reader-named column. The two structural presets key nothing on
       * screen — their colors are the menu preview's.
       */
      get hasLegendKey(): boolean {
        const field = this.colorByField
        return (
          field === 'track' ||
          presetRamp(field) !== undefined ||
          isColumnField(field)
        )
      },
      /**
       * #getter
       * The legend-host half of `LegendMixin` a view needs: whether the key
       * draws, which is the mode having one and the reader not having closed
       * it in this mode. `ChromeLegend` and `SvgLegend` read it.
       */
      get showLegend(): boolean {
        return (
          this.hasLegendKey &&
          self.colorLegendDismissedFor !== this.colorByField
        )
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
       * color, however many levels it is on, and only under `colorBy: { field: 'track' }`,
       * since every other mode has a fixed legend of its own.
       */
      get colorLegendChips(): ColorChip[] {
        if (self.colorByField !== 'track') {
          return []
        }
        const names = new Map(
          self.colorableTracks.map(t => [t.trackId, t.name]),
        )
        return [...names].map(([trackId, label]) => ({
          color: this.trackColorFor(trackId),
          label,
        }))
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The active mode's key, or none for a mode without one. View-wide
       * rather than per display because the key is one box for the whole
       * view, and the ramp domain it labels is the view's.
       */
      get colorScales(): ColorScale[] {
        if (!self.hasLegendKey) {
          return []
        }
        const field = self.colorByField
        // only a text column's rows are the reader's to order; a track
        // palette and a ramp key what they key
        return colorByScales(field, {
          pointBased: self.legendPointBased(),
          cigarOps: self.legendCigarOps(),
          trackChips: self.colorLegendChips,
          attributeRanges: self.attributeRanges,
          alpha: self.legendAlpha(),
          hideUnlabelled: self.hideUnlabelled,
        }).map(scale =>
          scale.kind === 'categorical' &&
          scale.id === field &&
          isColumnField(field)
            ? { ...scale, domain: [...self.colorDomain] }
            : scale,
        )
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The key `ChromeLegend` draws on screen and `SvgLegend` in the export.
       */
      get legendSpec(): LegendSpec {
        return legendSpecOf(self.colorScales)
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
         */
        setHideUnlabelled(value: boolean) {
          self.hideUnlabelled = value
        },
        /**
         * #action
         * Set the field the view paints by over the `colorBy` object (`''`
         * for the default colour), and rescale the ramp, which is the only way
         * back from a domain one outlying window widened.
         */
        setColorBy(field: string) {
          self.colorBy = cast(syntenyColorFor(field, self.colorBySetting))
          forgetSeenRanges()
        },
        /**
         * #action
         * Declare the order a text column's labels take. The labels listed
         * lead, the rest follow sorted; an empty list gives back the order the
         * fetches found them in.
         */
        setColorDomain(domain: string[]) {
          self.colorBy = cast({ ...self.colorBySetting, domain })
        },
        /**
         * #action
         * Pin one track's color under `colorBy: { field: 'track' }`, or release it back to
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
        /**
         * #action
         * The legend host's setter: closing the key hides it for this mode
         * only, so picking another mode brings its key up.
         */
        setShowLegend(show: boolean) {
          self.colorLegendDismissedFor = show ? undefined : self.colorByField
        },
        /**
         * #action
         * One section is the whole key here.
         */
        dismissLegendSection() {
          self.colorLegendDismissedFor = self.colorByField
        },
      }
    })
}
