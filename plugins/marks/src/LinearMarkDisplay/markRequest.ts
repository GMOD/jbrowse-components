/**
 * The worker request as the config declares it: each mark's encoding and step
 * list in the wire form `CoreGetEncodedLayers` takes, every slot written out so
 * a slot left at its default and one written at it are one fetch.
 */
import { aggregateFieldName } from '@jbrowse/core/util/aggregateFieldName'
import { DEFAULT_MARK_COLOR } from '@jbrowse/core/util/markEncoding'
import {
  featureColorEncoding,
  paintedColorEncoding,
} from '@jbrowse/display-kit/colorConfigSchema'

import { binStepWidth } from './autoBin.ts'
import { markShapeScale } from './configSchema.ts'
import { zoomInRange } from './markList.ts'
import { MARK_SPECS, markLanes, plotsValue, readsValue } from './markSpecs.ts'
import {
  DEFAULT_BIN_AS,
  DEFAULT_BIN_FIELD,
  DEFAULT_CELLS_FIELD,
  DEFAULT_COVERAGE_AS,
  DEFAULT_FLATTEN_FIELD,
  DEFAULT_FORMULA_AS,
  DEFAULT_PILEUP_AS,
  DEFAULT_PILEUP_FIELDS,
  DEFAULT_STACK_AS,
  DEFAULT_STACK_FIELD,
  DEFAULT_X2,
} from './markVocabulary.ts'
import { valueColorOf } from './valueColor.ts'

import type { MarkConfig, MarkTransformStepConfig } from './configSchema.ts'
import type { MarkEntry } from './markList.ts'
import type { MarkSpec } from './markSpecs.ts'
import type { StepChannels } from './stepChannels.ts'
import type {
  AggregateOp,
  LayerRequest,
  ShapeEncoding,
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
  const { x, shape, color, text, size } = mark.encoding
  const y = mark.encoding.y || filled.y
  const y2 = mark.encoding.y2 || filled.y2
  const row = mark.encoding.row || filled.row
  const spec: MarkSpec = MARK_SPECS[mark.mark]
  const channels = spec.channels as readonly string[]
  // The request carries only what the mark's type reads, so editing a slot it
  // draws nothing from refetches no region.
  const reads = (channel: string) => channels.includes(channel)
  // Only a mark whose far foot may lie elsewhere reaches the other end a
  // `mate` step found; a span or bar behind one keeps its own interval.
  const x2 =
    mark.encoding.x2.pos === DEFAULT_X2 &&
    !mark.encoding.x2.chrom &&
    spec.farFoot
      ? (filled.x2 ?? mark.encoding.x2)
      : mark.encoding.x2
  const shapeEncoding: ShapeEncoding =
    markShapeScale(shape) === 'none'
      ? shape.value
      : {
          field: shape.field,
          scale: 'categorical',
          range: shape.range.length > 0 ? [...shape.range] : undefined,
          domain: shape.domain.length > 0 ? [...shape.domain] : undefined,
        }
  return {
    x,
    // A far end on another sequence names the field holding which; a plain
    // position crosses as the field alone.
    x2: x2.chrom ? { chrom: x2.chrom, pos: x2.pos } : x2.pos,
    // The field alone: the worker reads a value, and the scale it is read
    // through is the display's `scales.y`. Shipping that scale would put the
    // axis type and its bounds in the fetch's inputs, so a menu toggle
    // between linear and log would refetch every region to no effect.
    y: reads('y') && y ? y : undefined,
    y2: reads('y2') && y2 ? y2 : undefined,
    row: (reads('row') && row) || undefined,
    // A quantitative colour over the plotted field is the display's to
    // resolve off the `y` lane (`valueColor.ts`), so it crosses as the
    // default and an edit to its cuts, ends or colours refetches nothing.
    color: valueColorOf(mark, filled)
      ? DEFAULT_MARK_COLOR
      : (paintedColorEncoding(featureColorEncoding(color)) ??
        DEFAULT_MARK_COLOR),
    ...(reads('shape') ? { shape: shapeEncoding } : {}),
    ...(reads('text') && text ? { text } : {}),
    ...(reads('size') && size.field !== ''
      ? {
          size: {
            field: size.field,
            scale: size.scale,
            ...(size.domainMin === undefined
              ? {}
              : { domainMin: size.domainMin }),
            ...(size.domainMax === undefined
              ? {}
              : { domainMax: size.domainMax }),
            ...(size.range.length === 2
              ? {
                  range: [Number(size.range[0]), Number(size.range[1])] as [
                    number,
                    number,
                  ],
                }
              : {}),
          },
        }
      : {}),
  }
}

function pairOf(
  values: readonly string[],
  fallback: readonly [string, string],
): [string, string] {
  const [a, b] = values
  return values.length === 2 && a !== undefined && b !== undefined
    ? [a, b]
    : [...fallback]
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
      return intervalFields(step) ? field : step.field
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

function binEdgesOf(step: { as: readonly string[] }) {
  return pairOf(step.as, DEFAULT_BIN_AS)
}

// The interval a `bin` cuts at its edges, where its `fields` names two; any
// other number bins by `field`, as the rule list says.
function intervalFields(step: {
  fields: readonly string[]
}): [string, string] | undefined {
  const [start, end] = step.fields
  return step.fields.length === 2 && start && end ? [start, end] : undefined
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
  // the value the steps so far wrote, which a stack naming no field sums
  let value: string | undefined
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
      case 'aggregate': {
        const ops = step.ops.map((o): AggregateOp => {
          const op = {
            op: o.op,
            field: o.field || undefined,
            weight: o.weight || undefined,
          }
          return { ...op, as: o.as || aggregateFieldName(op) }
        })
        value = ops.length === 1 ? ops[0]!.as : undefined
        return {
          type: 'aggregate',
          groupby:
            step.groupby.length > 0 ? [...step.groupby] : (binEdges ?? []),
          ops,
        }
      }
      case 'coverage': {
        value = step.as || DEFAULT_COVERAGE_AS
        return { type: 'coverage', as: value, groupby: [...step.groupby] }
      }
      case 'stack': {
        const as = pairOf(step.as, DEFAULT_STACK_AS)
        const field = step.field || value || DEFAULT_STACK_FIELD
        value = as[1]
        return {
          type: 'stack',
          field,
          groupby:
            step.groupby.length > 0
              ? [...step.groupby]
              : (binEdges ?? [...DEFAULT_BIN_AS]),
          by: step.by,
          as,
        }
      }
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
  return plotsValue(mark.mark) && (mark.encoding.y !== '' || !!channels.y)
}

/** A mark's type, zoom range and whether it stands at a value, what the mark list is built from. */
export function markEntryOf(
  mark: MarkConfig,
  channels: StepChannels,
): MarkEntry {
  const valued = marksValue(mark, channels)
  return {
    type: mark.mark,
    minBpPerPx: mark.minBpPerPx,
    maxBpPerPx: mark.maxBpPerPx,
    placed: !readsValue(mark.mark) || valued,
    valued,
    linkShape: mark.linkShape,
    interpolate: mark.interpolate,
  }
}

/**
 * One mark's worker request at `bpPerPx`: its encoding, its steps, and the
 * lanes its type reads. A mark that may plot a value but names none asks for
 * no `y` lane, so the worker fills no zeros for it to stand at; the same for
 * a size no field feeds.
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
  const valueColored = valueColorOf(mark, channels) !== undefined
  const lanes = markLanes(mark.mark).filter(
    lane =>
      (lane !== 'y' || marksValue(mark, channels)) &&
      (lane !== 'y2' || !!(mark.encoding.y2 || channels.y2)) &&
      (lane !== 'size' || mark.encoding.size.field !== '') &&
      ((lane !== 'color' && lane !== 'colorValue') || !valueColored),
  )
  return {
    encoding: encodingOf(mark, channels),
    lanes,
    ...(transform.length > 0 ? { transform } : {}),
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
