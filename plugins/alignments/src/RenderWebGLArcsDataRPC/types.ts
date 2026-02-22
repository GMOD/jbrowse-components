export interface WebGLArcsDataResult {
  regionStart: number
  // Arc data - compact per-arc records (curve computed on GPU)
  arcX1: Float32Array // start x offset from regionStart
  arcX2: Float32Array // end x offset from regionStart
  arcColorTypes: Float32Array // color types
  arcIsArc: Uint8Array // 1=semicircle, 0=bezier
  numArcs: number
  // Vertical lines for inter-chromosomal and long-range connections
  linePositions: Uint32Array // x positions (2 per line for start/end)
  lineYs: Float32Array // y positions (2 per line: y0, y1)
  lineColorTypes: Float32Array // color types (2 per line)
  numLines: number
  // Coverage data (basic depth from feature start/end, no CIGAR-level detail)
  coverageDepths: Float32Array
  coverageMaxDepth: number
  coverageBinSize: number
  coverageStartOffset: number
}
