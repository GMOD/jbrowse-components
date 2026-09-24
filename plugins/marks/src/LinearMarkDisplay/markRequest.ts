/**
 * The worker request as the config declares it: each mark's encoding and step
 * list in the wire form `CoreEncodeFeatures` takes, every slot written out so
 * a slot left at its default and one written at it are one fetch.
 */
import { aggregateFieldName } from '@jbrowse/core/util/aggregateFieldName'
import { colorEncodingOf } from '@jbrowse/display-kit/colorConfigSchema'

import { binStepWidth } from './autoBin.ts'
import { markShapeScale } from './configSchema.ts'
import { MARK_SPECS } from './markSpecs.ts'
import { DEFAULT_BIN_AS, DEFAULT_PILEUP_FIELDS } from './markVocabulary.ts'

import type { MarkConfig, MarkTransformStepConfig } from './configSchema.ts'
import type {
  AggregateOp,
  ShapeEncoding,
  MarkEncoding,
  TransformStep,
} from '@jbrowse/core/util/markEncoding'
import type { Region } from '@jbrowse/core/util/types/data'

// The config's raw slot values as the worker's encoding: a `jexl:` string
// crosses untouched, which is why nothing here reads through `getConf`.
export function encodingOf(mark: MarkConfig): MarkEncoding {
  const { x, x2, y, row, shape, color, text, size } = mark.encoding
  const scaled = colorEncodingOf(color, 'categorical')
  const channels = MARK_SPECS[mark.mark].channels as readonly string[]
  const readsText = channels.includes('text')
  const readsSize = channels.includes('size') && size.field !== ''
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
    y: y === '' ? undefined : y,
    row: row || undefined,
    color: scaled,
    shape: shapeEncoding,
    // Only a mark that prints it sends it, so every other mark's request is
    // the one it was.
    ...(readsText && text ? { text } : {}),
    ...(readsSize
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
      return step.field
    }
    if (
      step.type === 'coverage' ||
      step.type === 'flatten' ||
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
 * A step list as the worker's, with an `auto` bin resolved at `bpPerPx`.
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
        return { type: 'formula', expr: step.expr, as: step.as }
      case 'bin':
        binEdges = binEdgesOf(step)
        return {
          type: 'bin',
          step: binStepWidth(step.step, bpPerPx),
          field: step.field,
          as: binEdges,
        }
      case 'aggregate':
        return {
          type: 'aggregate',
          groupby:
            step.groupby.length > 0 ? [...step.groupby] : (binEdges ?? []),
          ops: step.ops.map((o): AggregateOp => {
            const op = { op: o.op, field: o.field || undefined }
            return { ...op, as: o.as || aggregateFieldName(op) }
          }),
        }
      case 'coverage':
        return { type: 'coverage', as: step.as }
      case 'flatten':
        return {
          type: 'flatten',
          field: step.field,
          index: step.index,
          keepEmpty: step.keepEmpty,
        }
      case 'pileup':
        return {
          type: 'pileup',
          as: step.as,
          fields: pairOf(step.fields, DEFAULT_PILEUP_FIELDS),
          padding: step.padding,
        }
      case 'mate':
        return { type: 'mate' }
    }
  })
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
