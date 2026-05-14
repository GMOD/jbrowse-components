import FeatureRendererType from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'

// Minimal renderer stub — the color config schema is still needed by the
// display's configSchemaFactory. All actual rendering is done by the GPU
// display (LinearManhattanDisplayComponent + GpuManhattanRenderer).
export default class ManhattanPlotRenderer extends FeatureRendererType {}
