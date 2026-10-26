import { readConfObject, setConf } from '@jbrowse/core/configuration'
import { coarseStripHTML, getSession } from '@jbrowse/core/util'
import { withImpliedField } from '@jbrowse/core/util/colorScale'
import { groupKeyComparator } from '@jbrowse/core/util/groupKeys'
import { writtenColorOf } from '@jbrowse/display-kit/ColorWritesMixin'
import ParkedColorMixin from '@jbrowse/display-kit/ParkedColorMixin'
import SolidColorDialog from '@jbrowse/display-kit/SolidColorDialog'
import {
  colorForField,
  colorForValue,
  colorSnapshotOf,
  ordinalRange,
} from '@jbrowse/display-kit/colorConfigSchema'
import { types } from '@jbrowse/mobx-state-tree'
import { compareStructural } from 'mobx'

import { SyntenyFilterMixin } from './SyntenyFilterMixin.ts'
import { MAX_DISTINCT_VALUES } from './attributeChannels.ts'
import { DEFAULT_RIBBON_CSS } from './colorFunctions.ts'
import { colorByScales } from './colorLegend.ts'
import {
  colorPaintOf,
  isAttributeLabels,
  isMeasureField,
  labelsOf,
  resolveCategoricalMode,
} from './colorRamps.ts'
import { hidesUnlabelled, withHideUnlabelled } from './hideUnlabelledFilter.ts'
import { paintedField } from './syntenyColorBy.ts'
import { SYNTENY_VIEW_FIELDS } from './syntenyColorConfigSchema.ts'
import { syntenyEncodingConfigSchema } from './syntenyEncodingConfigSchema.ts'
import { assignTrackColors, syntenyTrackPalette } from './trackColors.ts'

import type { CigarOpMask, ColorChip } from './colorLegend.ts'
import type { SyntenyColorSurface } from './colorModes.ts'
import type { AttributeRange, SyntenyColorPaint } from './colorRamps.ts'
import type { SyntenyColorSnapshot } from './syntenyColorConfigSchema.ts'
import type { ColorableTrack } from './trackColors.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { ColorScale } from '@jbrowse/core/ui/colorScale'
import type { ColorSlots } from '@jbrowse/core/util/colorScale'

const STRUCTURAL_FIELDS: ReadonlySet<string> = new Set(SYNTENY_VIEW_FIELDS)

function isColumnField(field: string | undefined): field is string {
  return (
    field !== undefined &&
    !STRUCTURAL_FIELDS.has(field) &&
    !isMeasureField(field)
  )
}

// A label list only ever gains labels, in the order they were first seen, and
// a label's file color is whichever was seen first; a row with no value, once
// seen, stays in the key the same way. Once any fetch meets text the column is
// categorical, and a span's distinct numbers join its labels as text.
function widenOne(
  prev: AttributeRange,
  range: AttributeRange,
): AttributeRange | undefined {
  const missing = !!(prev.missing || range.missing)
  if (isAttributeLabels(range) || isAttributeLabels(prev)) {
    const prevLabels = isAttributeLabels(prev) ? prev : undefined
    const before = labelsOf(prev)
    const seen = new Set(before)
    const added = labelsOf(range).filter(l => !seen.has(l))
    const colors = isAttributeLabels(range) ? range.colors : {}
    const newColors = Object.entries(colors).filter(
      ([l]) => prevLabels?.colors[l] === undefined,
    )
    return prevLabels &&
      added.length === 0 &&
      newColors.length === 0 &&
      missing === !!prevLabels.missing
      ? undefined
      : {
          labels: [...before, ...added],
          colors: {
            ...prevLabels?.colors,
            ...Object.fromEntries(newColors),
          },
          ...(missing ? { missing } : {}),
        }
  }
  const values = widenValues(prev.values, range.values)
  return range.min < prev.min ||
    range.max > prev.max ||
    missing !== !!prev.missing ||
    values?.length !== prev.values?.length
    ? {
        min: Math.min(prev.min, range.min),
        max: Math.max(prev.max, range.max),
        ...(values ? { values } : {}),
        ...(missing ? { missing } : {}),
      }
    : undefined
}

// Distinct numbers only grow, in first-seen order, and either side having
// too many to list leaves none.
function widenValues(
  prev: readonly number[] | undefined,
  next: readonly number[] | undefined,
) {
  if (!prev || !next) {
    return undefined
  }
  const seen = new Set(prev)
  const added = next.filter(v => !seen.has(v))
  return added.length === 0
    ? prev
    : prev.length + added.length > MAX_DISTINCT_VALUES
      ? undefined
      : [...prev, ...added]
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

function sameList(a: readonly string[] = [], b: readonly string[]) {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

// The declared domain and range, applied at the read rather than to the
// accumulation: `widenOne` above stays first-seen, so clearing the domain
// gives back the order the fetches found. Each label range carries both, which
// decide its colors. Identity-preserving like `widenAttributeRanges`, and for
// the same reason.
export function orderAttributeLabels(
  ranges: Record<string, AttributeRange>,
  domain: readonly string[],
  palette: readonly string[] = [],
) {
  if (domain.length === 0 && palette.length === 0) {
    return ranges
  }
  const compare = domain.length > 0 ? groupKeyComparator(domain) : undefined
  const moved = Object.entries(ranges).flatMap(([name, range]) => {
    if (!isAttributeLabels(range)) {
      return []
    }
    const labels = compare ? [...range.labels].sort(compare) : range.labels
    return labels.every((label, i) => label === range.labels[i]) &&
      sameList(range.domain, domain) &&
      sameList(range.palette, palette)
      ? []
      : ([
          [
            name,
            {
              ...range,
              labels,
              seen: range.seen ?? range.labels,
              ...(domain.length > 0 ? { domain } : {}),
              ...(palette.length > 0 ? { palette } : {}),
            },
          ],
        ] as const)
  })
  return moved.length === 0
    ? ranges
    : { ...ranges, ...Object.fromEntries(moved) }
}

/**
 * #stateModel TrackColorsMixin
 *
 * The color-by state shared by every view that can draw more than one synteny
 * track at once: the view-wide color object and the palette that tells overlaid tracks
 * apart.
 *
 * A view supplies only `colorableTrackConfigs` — the dotplot walks its flat
 * `tracks`, a linear synteny view flattens `levels`. Everything downstream of
 * that list (palette assignment, mode resolution, legend rows) is identical, so
 * it lives here rather than being copied into both models.
 */
export function TrackColorsMixin({
  defaultColorField,
}: { defaultColorField?: string } = {}) {
  const writtenOf = (color: AnyConfigurationModel) =>
    withImpliedField(writtenColorOf(color), defaultColorField)
  return types
    .compose(
      SyntenyFilterMixin(),
      ParkedColorMixin(),
      types.model({
        /**
         * #property
         * The channels every track in the view paints with, a
         * [](/docs/config/syntenyencoding) object. Its `color` is a
         * [](/docs/config/syntenycolor) channel: `"strand"`, `"query"`,
         * `"reference"`, `"track"`, a measurement (`identity`, `mapq`,
         * `dnds`) or a column the tracks declare, with `scale.domain`
         * ordering a text column's labels, `scale.range` coloring them and
         * `scale.names` naming them in the key, `scale.range` or
         * `scale.scheme`, `scale.reverse` and pinned ends reshaping a ramp,
         * and `scale.type: 'threshold'` binning a number at `scale.domain`'s
         * cuts; `{ value }` paints every alignment. Unset, the view's default
         * paints: `query` on the circular view, the default scheme elsewhere.
         * Its `opacity` is a [](/docs/config/syntenyopacity) channel.
         */
        encoding: types.stripDefault(syntenyEncodingConfigSchema, {}),
        /**
         * #property
         * trackId -> explicit color under `encoding.color: 'track'`. Absent
         * means the track takes an automatic slot from the palette.
         */
        trackColors: types.map(types.string),
      }),
    )
    .volatile(() => ({
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
       * `attributeColumns`), each of which the palette menu offers as a separate
       * mode, less the reserved `color` column. Overridden by the composing
       * view, which is the only thing that can reach the track configs.
       *
       * From the config rather than from loaded data: the menu has to be right
       * before the first fetch, and a track that declares a column with no
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
       * From loaded data rather than from the config, unlike
       * `colorableAttributeNames` — a column's observed span is not declared
       * anywhere, so nothing before the first fetch can answer it.
       */
      loadedAttributeRanges(): Record<string, AttributeRange>[] {
        return []
      },
      /**
       * #method
       * Overridable hook: the alpha the key's chips are composited with. The ribbon
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
       * Overridable hook: what draws each alignment, a ribbon with match and
       * indel blocks or one flat point (the dotplot). The key, the menu's help
       * text and which fields key at all read it.
       */
      colorSurface(): SyntenyColorSurface {
        return 'ribbons'
      },
      /**
       * #method
       * Overridable hook: whether the view has a shared reference for the
       * `reference` field to anchor on. It needs a stack of two or more
       * levels; below that it is query or target by another name.
       */
      offersReferenceColor(): boolean {
        return false
      },
    }))
    .views(self => ({
      /**
       * #method
       * Overridable hook: whether an alignment's shape shows its strand, which
       * spares the strand colors a key. A linear ribbon twists against its
       * rows' directions, which their rulers show; a whole-genome dotplot is
       * mostly dots with no slope to read.
       */
      shapeShowsStrand(): boolean {
        return self.colorSurface() === 'ribbons'
      },
      /**
       * #getter
       * `encoding.color` as its snapshot holds it, with the view's default
       * field where it names neither a field nor a constant.
       */
      get colorSetting(): SyntenyColorSnapshot {
        return withImpliedField(
          colorSnapshotOf(self.encoding.color),
          defaultColorField,
        )
      },
      /**
       * #getter
       * The field the view paints while `encoding.color` names neither a
       * field nor a constant, undefined for its default scheme.
       */
      get impliedColorField(): string | undefined {
        return defaultColorField
      },
      /**
       * #getter
       * What `encoding.color.scale` declares over a field's own scale: its
       * `type`, `domain`, `range` or `scheme` for its colors, `reverse`, and
       * a ramp's pinned ends and middle. Read from these slots alone, so a
       * key-only edit repaints nothing.
       */
      get colorPaint(): SyntenyColorPaint {
        return colorPaintOf(self.encoding.color)
      },
      /**
       * #getter
       * `encoding.color.value`: the color every alignment paints under the default
       * mode in place of the view's own scheme, or undefined for that scheme.
       */
      get colorValue(): string | undefined {
        return this.colorSetting.value
      },
      /**
       * #getter
       * `encoding.color.scale.domain`, the order a text column's labels
       * take. Read from that slot alone, so a key-only edit (`legend.title`,
       * `scale.names`) recolors nothing.
       */
      get colorDomain(): readonly string[] {
        return readConfObject(self.encoding.color.scale, 'domain')
      },
      /**
       * #getter
       * The colors a text column's labels take in domain order:
       * `encoding.color.scale.range`, else its `scheme` sampled once per
       * domain value
       */
      get colorRange(): readonly string[] {
        const { scale } = self.encoding.color
        return ordinalRange({
          domain: this.colorDomain,
          range: readConfObject(scale, 'range'),
          scheme: readConfObject(scale, 'scheme'),
        })
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
       * The domain is monotonic. A fetch's payload reports the span of the
       * slice it holds, and that slice is the snapped window: painting straight
       * off it re-maps every feature onto the ramp each time a pan rolls the
       * window over, so a ribbon in the middle of the ramp turns into one at the
       * bottom while the reader is scrolling and its value has not changed. A
       * domain that only ever widens stays accurate for what the reader is
       * looking at (the legend prints the actual numbers) and settles instead of
       * oscillating.
       *
       * The domain is monotonic only until a mode is picked, which is the way back: one window
       * holding an outlier would otherwise compress the ramp for the rest of the
       * session, and the union above is over the loaded spans, so
       * `resetAttributeRanges` rescales to what is on screen there and then.
       *
       * View-wide rather than per display because the floating legend is one box
       * for the whole view: two displays scaling the same ramp from different
       * spans would make that legend wrong for one of them.
       */
      get attributeRanges(): Record<string, AttributeRange> {
        const widened = self
          .loadedAttributeRanges()
          .reduce(widenAttributeRanges, self.seenAttributeRanges)
        return orderAttributeLabels(widened, this.colorDomain, this.colorRange)
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
       * trackId -> the color it draws in under `encoding.color: 'track'`.
       * Assigned across the whole view rather than per display, so an automatic slot
       * can't duplicate a color pinned on a sibling.
       */
      get trackColorAssignments(): Map<string, string> {
        return assignTrackColors(self.colorableTracks)
      },
      /**
       * #getter
       * The field `encoding.color` paints by, undefined for the default color.
       */
      get colorField(): string | undefined {
        return paintedField(self.colorSetting)
      },
      /**
       * #getter
       * Whether the filter drops the alignments with no value for the field
       * the view paints by, the "Hide unlabelled rows" box.
       */
      get hideUnlabelled(): boolean {
        return hidesUnlabelled(self.predicates, this.colorField)
      },
      /**
       * #getter
       * Whether the mode has a key worth a box: a track palette, a ramp, a
       * reader-named column, or strand wherever the shape does not show it
       * (`shapeShowsStrand`), which leaves the color the only strand cue.
       */
      get hasLegendKey(): boolean {
        const field = this.colorField
        return (
          field === 'track' ||
          (field === 'strand' && !self.shapeShowsStrand()) ||
          isMeasureField(field) ||
          isColumnField(field)
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
       * color, however many levels it is on, and only under `encoding.color: 'track'`,
       * since every other mode has a fixed legend.
       */
      get colorLegendChips(): ColorChip[] {
        if (self.colorField !== 'track') {
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
        const field = self.colorField
        if (!self.hasLegendKey || field === undefined) {
          return []
        }
        const { scale, legend } = self.colorSetting
        const textColumn =
          isColumnField(field) &&
          resolveCategoricalMode(field, self.attributeRanges) !== undefined
        // only a text column's rows are the reader's to order; a track
        // palette, a ramp and bins key what they key
        return colorByScales(field, {
          pointBased: self.colorSurface() === 'points',
          cigarOps: self.legendCigarOps(),
          trackChips: self.colorLegendChips,
          attributeRanges: self.attributeRanges,
          alpha: self.legendAlpha(),
          hideUnlabelled: self.hideUnlabelled,
          missingColor: self.colorPaint.invalid,
          names: scale?.names,
          title: legend?.title,
          descending: legend?.descending,
          paint: self.colorPaint,
        }).map(scale =>
          scale.kind === 'categorical' && scale.id === field && textColumn
            ? { ...scale, domain: [...self.colorDomain] }
            : scale,
        )
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
      // a pick of what already paints writes nothing, so nothing keyed on the
      // channel's arrays recomputes
      function writeColor(written: ColorSlots, next: ColorSlots) {
        if (!compareStructural(next, written)) {
          const field = self.colorField
          self.parkColor('color', written, next)
          setConf(self.encoding, 'color', next)
          if (field !== undefined && field !== self.colorField) {
            self.setFilter(withHideUnlabelled(self.predicates, field, false))
          }
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
         * what the loaded fetches cover and nothing else.
         *
         * The way back from a monotonic domain, and the only one: a single
         * window holding an outlier widens the ramp for the rest of the
         * session, and `attributeRanges` unions the loaded spans over this, so
         * a reset rescales to what is on screen without waiting for a refetch.
         * Picking a mode calls it: a reader picks the mode again when the
         * ramp shows nothing useful.
         */
        resetAttributeRanges() {
          forgetSeenRanges()
        },
        /**
         * #action
         */
        setHideUnlabelled(value: boolean) {
          const field = self.colorField
          if (field === undefined) {
            return
          }
          self.setFilter(withHideUnlabelled(self.predicates, field, value))
        },
        /**
         * #action
         * Set the field the view paints by over `encoding.color`, undefined
         * unsetting it for the view's default, and rescale the ramp, which is
         * the only way back from a domain one outlying window widened.
         */
        setColorField(field: string | undefined) {
          const written = writtenOf(self.encoding.color)
          const next =
            field === undefined
              ? colorForValue(written, undefined)
              : colorForField(written, field, self.parkedColor)
          writeColor(written, next)
          forgetSeenRanges()
        },
        /**
         * #action
         * Paint every alignment `value`, undefined returning to the view's
         * default.
         */
        setColorValue(value: string | undefined) {
          const written = writtenOf(self.encoding.color)
          writeColor(written, colorForValue(written, value))
        },
        /**
         * #action
         * The picker Color by's Solid color... opens.
         */
        openSolidColorDialog() {
          getSession(self).queueDialog(handleClose => [
            SolidColorDialog,
            {
              label: 'Alignment color',
              color: self.colorSetting.value ?? DEFAULT_RIBBON_CSS,
              written: self.colorSetting.value,
              onChange: (color: string) => {
                this.setColorValue(color)
              },
              onReset: () => {
                this.setColorValue(undefined)
              },
              handleClose,
            },
          ])
        },
        /**
         * #action
         * Declare the order a text column's labels take. The labels listed
         * lead, the rest follow sorted; an empty list gives back the order the
         * fetches found them in.
         */
        setColorDomain(domain: string[]) {
          const written = writtenColorOf(self.encoding.color)
          setConf(self.encoding, 'color', {
            ...written,
            scale: { ...written.scale, domain },
          })
        },
        /**
         * #action
         * Pin one track's color under `encoding.color: 'track'`, or release it back to
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
      }
    })
}
