export { default as baseLinearDisplayConfigSchema } from './models/configSchema.ts'
export type { BlockModel } from './models/serverSideRenderedBlock.ts'
export { BaseLinearDisplay } from './model.ts'
export type {
  BaseLinearDisplayModel,
  BaseLinearDisplayStateModel,
  LegendItem,
} from './model.ts'
export type {
  ExportSvgDisplayOptions,
  FloatingLabelData,
  LayoutFeatureMetadata,
} from './types.ts'
export { createSubfeatureLabelMetadata } from './types.ts'

export {
  BlockMsg,
  Tooltip,
  default as BaseLinearDisplayComponent,
} from './components/BaseLinearDisplay.tsx'
export { default as TrackHeightMixin } from './models/TrackHeightMixin.tsx'
export { default as FeatureDensityMixin } from './models/FeatureDensityMixin.tsx'
export {
  type NonBlockCanvasDisplayMixinType,
  default as NonBlockCanvasDisplayMixin,
} from './models/NonBlockCanvasDisplayMixin.tsx'
export { drawCanvasImageData } from './util.ts'
export { default as TooLargeMessage } from './components/TooLargeMessage.tsx'
export { default as FloatingLegend } from './components/FloatingLegend.tsx'
export { default as NonBlockCanvasDisplayComponent } from './components/NonBlockCanvasDisplayComponent.tsx'
export type { NonBlockCanvasDisplayModel } from './components/NonBlockCanvasDisplayComponent.tsx'
export { default as SVGLegend } from './SVGLegend.tsx'
export { calculateSvgLegendWidth } from './calculateSvgLegendWidth.ts'
