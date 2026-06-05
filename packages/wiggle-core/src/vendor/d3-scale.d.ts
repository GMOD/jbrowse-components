// Minimal type declarations for the vendored d3-scale subset (scaleLinear,
// scaleLog, scaleQuantize). Full d3-scale types live in @types/d3-scale.

export interface Scale {
  (x: number): number
  domain(): number[]
  domain(d: number[]): this
  range(): number[]
  range(r: number[]): this
  nice(count?: number): this
  ticks(count?: number): number[]
}

export interface LogScale extends Scale {
  base(): number
  base(b: number): this
}

export declare function scaleLinear(): Scale
export declare function scaleLog(): LogScale
export declare function scaleQuantize(): Scale
