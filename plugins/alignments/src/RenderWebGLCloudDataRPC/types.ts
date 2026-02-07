export interface WebGLCloudDataResult {
  regionStart: number
  chainPositions: Uint32Array // [start, end] pairs as offsets from regionStart
  chainYs: Float32Array // log-scaled y positions (0-1)
  chainFlags: Uint16Array
  chainColorTypes: Uint8Array // 0=normal, 1=long, 2=short, 3=interchrom, 4=orientation
  numChains: number
  maxDistance: number
}
