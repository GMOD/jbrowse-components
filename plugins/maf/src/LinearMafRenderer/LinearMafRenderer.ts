import { FeatureRendererType } from '@jbrowse/core/pluggableElementTypes'

// Stub — rendering is handled by the GPU backend (MafRendererFactory).
// This registration exists so that rendererTypeName resolves and the
// JBrowse config schema machinery works.
export default class LinearMafRenderer extends FeatureRendererType {}
