export function bpToScreenPx(
  bp: number,
  regionStart: number,
  regionEnd: number,
  screenStartPx: number,
  screenEndPx: number,
  reversed?: boolean,
) {
  const frac = (bp - regionStart) / (regionEnd - regionStart)
  const sw = screenEndPx - screenStartPx
  return reversed ? screenEndPx - frac * sw : screenStartPx + frac * sw
}
