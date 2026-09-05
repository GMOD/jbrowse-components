export { createMarkBackend, paintMarkBlocks } from './markBackend.ts'
export { defineMark } from './types.ts'
export { pointMark } from './pointMark.ts'
export { appendGlyph } from './glyphPaint.ts'
export { spanMark } from './spanMark.ts'
export { abgrToCssRgba, makeAbgrFill } from './colorFill.ts'

export type {
  Mark,
  MarkContext2D,
  MarkFrame,
  MarkHit,
  MarkShape,
} from './types.ts'
export type { PointChannels, PointParams } from './pointMark.ts'
export type { SpanChannels, SpanParams } from './spanMark.ts'
