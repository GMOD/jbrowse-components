export { defineMark } from './types.ts'
export { paintMarkBlocks } from './markPaint.ts'
export { planMarks } from './markPlan.ts'
export { inkOfInstances } from './markInk.ts'
export { backToFront, nearestMarkHit, valueWindow } from './nearestMarkHit.ts'
export { barMark } from './barMark.ts'
export { pointMark } from './pointMark.ts'
export { spanMark } from './spanMark.ts'
export { appendGlyph, pointInsetPx } from './glyphPaint.ts'
export { abgrToCssRgba, makeAbgrFill } from './colorFill.ts'

export type { MarkPlan } from './markPlan.ts'
export type { MarkInstance } from './markInk.ts'
export type { HitWindow, NearestMarkHit } from './nearestMarkHit.ts'
export type {
  Mark,
  MarkBand,
  MarkContext2D,
  MarkFrame,
  MarkImage,
  MarkRamp,
  MarkTexture,
  MarkValueScaleType,
  InkRect,
  MarkHit,
  MarkShape,
  PlannedPass,
  StagedUniforms,
} from './types.ts'
export type { BarChannels, BarParams } from './barMark.ts'
export type { PointChannels, PointParams } from './pointMark.ts'
export type { SpanChannels, SpanParams } from './spanMark.ts'
export type { ColorChannel } from './markRamp.ts'
