export { defineMark } from './types.ts'
export { paintMarkBlocks } from './markPaint.ts'
export { pointMark } from './pointMark.ts'
export { spanMark } from './spanMark.ts'
export { appendGlyph } from './glyphPaint.ts'
export { abgrToCssRgba, makeAbgrFill } from './colorFill.ts'

export type {
  Mark,
  MarkBand,
  MarkContext2D,
  MarkFrame,
  MarkHit,
  MarkShape,
} from './types.ts'
export type { PointChannels, PointParams } from './pointMark.ts'
export type { SpanChannels, SpanParams } from './spanMark.ts'
