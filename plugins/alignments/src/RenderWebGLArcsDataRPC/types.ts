export interface WebGLArcsDataResult {
  regionStart: number
  // Arc data - tessellated bezier curves as line strips
  arcPositions: Uint32Array // x positions as offsets from regionStart
  arcYs: Float32Array // y positions
  arcColorTypes: Float32Array // color types
  arcOffsets: number[] // start index for each arc
  arcLengths: number[] // vertex count for each arc
  numArcs: number
  // Vertical lines for inter-chromosomal and long-range connections
  linePositions: Uint32Array // x positions (2 per line for start/end)
  lineYs: Float32Array // y positions (2 per line: y0, y1)
  lineColorTypes: Float32Array // color types (2 per line)
  numLines: number
}
