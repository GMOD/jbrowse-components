export type SliderScale = 'linear' | 'log' | 'cubic'

// Maps a real-unit value to/from a MUI Slider's internal thumb position for
// non-linear controls, so callers pass real-unit min/max/value and read
// real-unit values back. 'log' (log2 × 100) suits quantities spanning orders of
// magnitude (bp window/step/length, read-support counts); 'cubic' gives fine
// control near 0 where small changes read as large (opacity). `sliderStep` is
// the step in slider space (undefined for linear — the caller supplies a
// real-unit step). Single source for these transforms across the inline
// track-menu sliders (makeSizeMenu) and the synteny/dotplot settings popovers.
export function sliderScale(scale: SliderScale) {
  if (scale === 'log') {
    return {
      toSlider: (n: number) => Math.log2(Math.max(1, n)) * 100,
      fromSlider: (v: number) => Math.round(2 ** (v / 100)),
      sliderStep: 1 as number | undefined,
    }
  }
  if (scale === 'cubic') {
    return {
      toSlider: (n: number) => Math.cbrt(n),
      fromSlider: (v: number) => v ** 3,
      sliderStep: 0.01 as number | undefined,
    }
  }
  return {
    toSlider: (n: number) => n,
    fromSlider: (v: number) => v,
    sliderStep: undefined as number | undefined,
  }
}
