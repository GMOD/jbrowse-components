/**
 * The worker request as the config declares it: each mark's encoding and step
 * list in the wire form `CoreGetEncodedLayers` takes, every slot written out so
 * a slot left at its default and one written at it are one fetch.
 */
import { aggregateFieldName } from '@jbrowse/core/util/aggregateFieldName'
import { isFieldPair } from '@jbrowse/core/util/stepOutputs'

import { binStepWidth } from './autoBin.ts'
import { markShapeScale } from './configSchema.ts'
import { colorLanesOf, markColorOf, wireColorOf } from './markColor.ts'
import { zoomInRange } from './markList.ts'
import {
  MARK_SPECS,
  interpolationOf,
  markLanes,
  plotsValue,
  readsValue,
} from './markSpecs.ts'
import {
  DEFAULT_BIN_AS,
  DEFAULT_BIN_FIELD,
  DEFAULT_CELLS_FIELD,
  DEFAULT_COVERAGE_AS,
  DEFAULT_FLATTEN_FIELD,
  DEFAULT_FORMULA_AS,
  DEFAULT_PILEUP_AS,
  DEFAULT_PILEUP_FIELDS,
  DEFAULT_WINDOW_FRAME,
  DEFAULT_X2,
  isWindowFrame,
} from './markVocabulary.ts'

import type { MarkConfig, MarkTransformStepConfig } from './configSchema.ts'
import type { ColorSource } from './markColor.ts'
import type { MarkEntry } from './markList.ts'
import type { MarkSpec } from './markSpecs.ts'
import type { StepChannels } from './stepChannels.ts'
import type {
  AggregateOp,
  LayerRequest,
  PathSpec,
  ShapeEncoding,
  SizeRef,
  MarkEncoding,
  TransformStep,
} from '@jbrowse/core/util/markEncoding'
import type { Region } from '@jbrowse/core/util/types/data'

// The config's raw slot values as the worker's encoding, each channel left
// unwritten taking what the mark's steps fill: a `jexl:` string crosses
// untouched, which is why nothing here reads through `getConf`.
export function encodingOf(
  mark: MarkConfig,
  filled: StepChannels = {},
): MarkEncoding {
  const { x, shape, text, strokeWidth } = mark.encoding
  const y = mark.encoding.y || filled.y
  const row = mark.encoding.row || filled.row
  const spec: MarkSpec = MARK_SPECS[mark.mark.type]
  const channels = spec.channels as readonly string[]
  // The request carries only what the mark's type reads, so editing a slot it
  // draws nothing from refetches no region.
  const reads = (channel: string) => channels.includes(channel)
  // Only a mark whose far foot may lie elsewhere reaches the other end a
  // `mate` step found; a span or bar behind one keeps its own interval.
  const x2 =
    mark.encoding.x2.pos === DEFAULT_X2 &&
    !mark.encoding.x2.refName &&
    spec.farFoot
      ? (filled.x2 ?? mark.encoding.x2)
      : mark.encoding.x2
  const shapeEncoding: ShapeEncoding =
    markShapeScale(shape) === 'none'
      ? shape.value
      : {
          field: shape.field,
          scale: 'ordinal',
          range:
            shape.scale.range.length > 0 ? [...shape.scale.range] : undefined,
          domain:
            shape.scale.domain.length > 0 ? [...shape.scale.domain] : undefined,
        }
  return {
    x,
    // A far end on another sequence names the field holding which; a plain
    // position crosses as the field alone.
    x2: x2.refName ? { refName: x2.refName, pos: x2.pos } : x2.pos,
    // The field alone: the worker reads a value, and the scale it is read
    // through is the display's `encoding.y`. Shipping that scale would put the
    // axis type and its bounds in the fetch's inputs, so a menu toggle
    // between linear and log would refetch every region to no effect.
    y: reads('y') && y ? y : undefined,
    row: (reads('row') && row) || undefined,
    // The display paints every color but a `jexl:` callback off what the
    // worker reads (`markColor.ts`), so an edit to one refetches nothing.
    color: wireColorOf(markColorOf(mark, filled)),
    ...(reads('shape') ? { shape: shapeEncoding } : {}),
    ...(reads('text') && text ? { text } : {}),
    // A link's stroke width crosses as the worker's `size`, the lane it
    // fills.
    ...(reads('strokeWidth') && strokeWidth.field !== ''
      ? { size: sizeRefOf(strokeWidth) }
      : {}),
  }
}

function sizeRefOf({
  field,
  scale,
}: MarkConfig['encoding']['strokeWidth']): SizeRef {
  const { type, domainMin, domainMax, range } = scale
  return {
    field,
    scale: type,
    ...(domainMin === undefined ? {} : { domainMin }),
    ...(domainMax === undefined ? {} : { domainMax }),
    ...(range.length === 2
      ? { range: [Number(range[0]), Number(range[1])] as [number, number] }
      : {}),
  }
}

function pairOf(
  values: readonly string[],
  fallback: readonly [string, string],
): [string, string] {
  return isFieldPair(values) ? [values[0], values[1]] : [...fallback]
}

/**
 * The field a position lane's number came from: the one a `bin` read where
 * the bin wrote the lane's field, since the bin writes NaN edges for a feature
 * lacking it, and the lane's own field where a later step made it anew.
 */
export function positionSource(
  steps: readonly MarkTransformStepConfig[],
  field: string,
): string {
  for (const step of steps.toReversed()) {
    if (
      step.type === 'bin' &&
      pairOf(step.as, DEFAULT_BIN_AS).includes(field)
    ) {
      return intervalFields(step) ? field : step.field || DEFAULT_BIN_FIELD
    }
    if (
      step.type === 'coverage' ||
      step.type === 'flatten' ||
      step.type === 'cells' ||
      (step.type === 'formula' && step.as === field)
    ) {
      return field
    }
  }
  return field
}

// A window's frame as the worker takes it: the one written where the step
// reads it, else the default, which the rule list names.
function frameOf(frame: unknown): [number | null, number | null] {
  return isWindowFrame(frame) ? [frame[0], frame[1]] : [...DEFAULT_WINDOW_FRAME]
}

function binEdgesOf(step: { as: readonly string[] }) {
  return pairOf(step.as, DEFAULT_BIN_AS)
}

// The interval a `bin` cuts at its edges, where its `fields` names two; any
// other number bins by `field`, as the rule list says.
function intervalFields(step: {
  fields: readonly string[]
}): [string, string] | undefined {
  return isFieldPair(step.fields) ? [step.fields[0], step.fields[1]] : undefined
}

/**
 * The edges the last `bin` of the display's own steps wrote, which a mark's
 * `aggregate` behind it groups by when it names no fields of its own, as one
 * behind a bin in the mark's own steps does.
 */
export function lastBinEdges(steps: readonly MarkTransformStepConfig[]) {
  const bin = steps.findLast(step => step.type === 'bin')
  return bin?.type === 'bin' ? binEdgesOf(bin) : undefined
}

/**
 * A step list as the worker's, with an `auto` bin resolved at `bpPerPx` and
 * an emptied name written as the default the channel reader assumed for it.
 * `binEdges` is what an aggregate naming no groupby groups by before any bin
 * of this list: the display's last bin's, for a mark's list.
 */
export function stepsOf(
  steps: readonly MarkTransformStepConfig[],
  bpPerPx: number,
  binEdges?: [string, string],
): TransformStep[] {
  return steps.map((step): TransformStep => {
    switch (step.type) {
      case 'filter':
        return { type: 'filter', expr: step.expr }
      case 'formula':
        return {
          type: 'formula',
          expr: step.expr,
          as: step.as || DEFAULT_FORMULA_AS,
        }
      case 'bin': {
        binEdges = binEdgesOf(step)
        const width = binStepWidth(step.step, bpPerPx)
        const fields = intervalFields(step)
        return fields
          ? { type: 'bin', step: width, fields, as: binEdges }
          : {
              type: 'bin',
              step: width,
              field: step.field || DEFAULT_BIN_FIELD,
              as: binEdges,
            }
      }
      case 'aggregate':
        return {
          type: 'aggregate',
          groupby:
            step.groupby.length > 0 ? [...step.groupby] : (binEdges ?? []),
          ops: step.ops.map((o): AggregateOp => {
            const op = {
              op: o.op,
              field: o.field || undefined,
              weight: o.weight || undefined,
            }
            return { ...op, as: o.as || aggregateFieldName(op) }
          }),
        }
      case 'window':
        return {
          type: 'window',
          groupby: [...step.groupby],
          frame: frameOf(step.frame),
          ops: step.ops.map((o): AggregateOp => {
            const op = {
              op: o.op,
              field: o.field || undefined,
              weight: o.weight || undefined,
            }
            return { ...op, as: o.as || aggregateFieldName(op) }
          }),
        }
      case 'coverage':
        return { type: 'coverage', as: step.as || DEFAULT_COVERAGE_AS }
      case 'flatten':
        return {
          type: 'flatten',
          field: step.field || DEFAULT_FLATTEN_FIELD,
          index: step.index,
          key: step.key,
          keepEmpty: step.keepEmpty,
        }
      case 'cells':
        return { type: 'cells', field: step.field || DEFAULT_CELLS_FIELD }
      case 'pileup':
        return {
          type: 'pileup',
          as: step.as || DEFAULT_PILEUP_AS,
          fields: pairOf(step.fields, DEFAULT_PILEUP_FIELDS),
          padding: step.padding,
        }
      case 'mate':
        return { type: 'mate' }
    }
  })
}

/**
 * Whether a mark plots a `y`, named or filled by its steps, and so folds into
 * the axis and stands at its value.
 */
export function marksValue(mark: MarkConfig, channels: StepChannels) {
  return plotsValue(mark.mark.type) && (mark.encoding.y !== '' || !!channels.y)
}

/** A mark's type, zoom range and whether it stands at a value, what the mark list is built from. */
export function markEntryOf(
  mark: MarkConfig,
  channels: StepChannels,
): MarkEntry {
  const valued = marksValue(mark, channels)
  const { type } = mark.mark
  // The one `interpolate`, as the link and the line shapes each name it.
  const interpolate = interpolationOf(type, mark.mark.interpolate)
  return {
    type,
    minBpPerPx: mark.minBpPerPx,
    maxBpPerPx: mark.maxBpPerPx,
    placed: !readsValue(type) || valued,
    valued,
    linkShape:
      interpolate === 'linear'
        ? 'line'
        : interpolate === 'arc'
          ? 'arc'
          : 'dome',
    interpolate: interpolate === 'linear' ? 'linear' : 'step',
  }
}

/**
 * One mark's worker request at `bpPerPx`: its encoding, its steps, and the
 * lanes its type reads. A mark that may plot a value but names none asks for
 * no `y` lane, so the worker fills no zeros for it to stand at; the same for
 * a stroke width no field feeds.
 */
export function markLayerRequest(
  mark: MarkConfig,
  channels: StepChannels,
  bpPerPx: number,
  binEdges?: [string, string],
): LayerRequest {
  const transform = stepsOf(
    mark.transform,
    zoomInRange(mark, bpPerPx),
    binEdges,
  )
  const color = markColorOf(mark, channels)
  const lanes = markLanes(mark.mark.type, colorLanesOf(color)).filter(
    lane =>
      (lane !== 'y' || marksValue(mark, channels)) &&
      (lane !== 'size' || mark.encoding.strokeWidth.field !== ''),
  )
  return {
    encoding: encodingOf(mark, channels),
    lanes,
    ...(transform.length > 0 ? { transform } : {}),
    ...(specOfMark(mark).path ? { path: pathOf(mark, color) } : {}),
  }
}

function specOfMark(mark: MarkConfig): MarkSpec {
  return MARK_SPECS[mark.mark.type]
}

// A path's series split by its ordinal color's field, as a Vega-Lite line
// is, and the gap it breaks at where the mark writes one.
function pathOf(mark: MarkConfig, color: ColorSource): PathSpec {
  return {
    ...(color.kind === 'categories' ? { by: color.encoding.field } : {}),
    ...(mark.mark.gapBp === undefined ? {} : { gapBp: mark.mark.gapBp }),
  }
}

/** The widest bin any step of a request writes, in bp; 0 with none. */
export function widestBinStep(steps: readonly TransformStep[]) {
  let widest = 0
  for (const step of steps) {
    if (step.type === 'bin' && step.step > widest) {
      widest = step.step
    }
  }
  return widest
}

/** A region widened to the bin edges around it, inside its assembly region. */
export function toBinEdges(region: Region, step: number, bounds: Region) {
  return {
    ...region,
    start: Math.max(bounds.start, Math.floor(region.start / step) * step),
    end: Math.min(bounds.end, Math.ceil(region.end / step) * step),
  }
}
