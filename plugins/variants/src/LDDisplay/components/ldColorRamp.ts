function interpolateStops(stops: [number, number, number][]): Uint8Array {
  const data = new Uint8Array(256 * 4)
  for (let i = 0; i < 256; i++) {
    const t = i / 255
    const stopIndex = t * (stops.length - 1)
    const lower = Math.floor(stopIndex)
    const upper = Math.min(lower + 1, stops.length - 1)
    const frac = stopIndex - lower
    const lo = stops[lower]!
    const hi = stops[upper]!

    data[i * 4] = Math.round(lo[0] * (1 - frac) + hi[0] * frac)
    data[i * 4 + 1] = Math.round(lo[1] * (1 - frac) + hi[1] * frac)
    data[i * 4 + 2] = Math.round(lo[2] * (1 - frac) + hi[2] * frac)
    data[i * 4 + 3] = 255
  }
  return data
}

const R2_STOPS: [number, number, number][] = [
  [255, 255, 255],
  [255, 224, 224],
  [255, 192, 192],
  [255, 128, 128],
  [255, 64, 64],
  [255, 0, 0],
  [208, 0, 0],
  [160, 0, 0],
]

const DPRIME_STOPS: [number, number, number][] = [
  [255, 255, 255],
  [224, 224, 255],
  [192, 192, 255],
  [128, 128, 255],
  [64, 64, 255],
  [0, 0, 255],
  [0, 0, 208],
  [0, 0, 160],
]

const R_SIGNED_STOPS: [number, number, number][] = [
  [0, 0, 160],
  [0, 0, 208],
  [0, 0, 255],
  [64, 64, 255],
  [128, 128, 255],
  [192, 192, 255],
  [224, 224, 255],
  [255, 255, 255],
  [255, 224, 224],
  [255, 192, 192],
  [255, 128, 128],
  [255, 64, 64],
  [255, 0, 0],
  [208, 0, 0],
  [160, 0, 0],
]

const DPRIME_SIGNED_STOPS: [number, number, number][] = [
  [0, 100, 0],
  [0, 128, 0],
  [0, 160, 0],
  [64, 192, 64],
  [128, 224, 128],
  [192, 240, 192],
  [224, 248, 224],
  [255, 255, 255],
  [224, 224, 255],
  [192, 192, 255],
  [128, 128, 255],
  [64, 64, 255],
  [0, 0, 255],
  [0, 0, 208],
  [0, 0, 160],
]

export function mapLDValue(ldVal: number, signedLD: boolean) {
  return Math.max(0, Math.min(1, signedLD ? (ldVal + 1) / 2 : ldVal))
}

const RAMPS = {
  r2: interpolateStops(R2_STOPS),
  dprime: interpolateStops(DPRIME_STOPS),
  r_signed: interpolateStops(R_SIGNED_STOPS),
  dprime_signed: interpolateStops(DPRIME_SIGNED_STOPS),
}

export function generateLDColorRamp(
  metric: string,
  signedLD: boolean,
): Uint8Array {
  if (signedLD) {
    return metric === 'dprime' ? RAMPS.dprime_signed : RAMPS.r_signed
  }
  return metric === 'dprime' ? RAMPS.dprime : RAMPS.r2
}
