export function getColorStops(ldMetric: string, signedLD: boolean) {
  if (signedLD) {
    if (ldMetric === 'dprime') {
      // Green (negative) -> White (zero) -> Blue (positive)
      return [
        { offset: '0%', color: 'rgb(0,100,0)' },
        { offset: '25%', color: 'rgb(64,192,64)' },
        { offset: '50%', color: 'rgb(255,255,255)' },
        { offset: '75%', color: 'rgb(128,128,255)' },
        { offset: '100%', color: 'rgb(0,0,160)' },
      ]
    }
    // Blue (negative) -> White (zero) -> Red (positive)
    return [
      { offset: '0%', color: 'rgb(0,0,160)' },
      { offset: '25%', color: 'rgb(128,128,255)' },
      { offset: '50%', color: 'rgb(255,255,255)' },
      { offset: '75%', color: 'rgb(255,128,128)' },
      { offset: '100%', color: 'rgb(160,0,0)' },
    ]
  }
  if (ldMetric === 'dprime') {
    return [
      { offset: '0%', color: 'rgb(255,255,255)' },
      { offset: '50%', color: 'rgb(128,128,255)' },
      { offset: '100%', color: 'rgb(0,0,160)' },
    ]
  }
  return [
    { offset: '0%', color: 'rgb(255,255,255)' },
    { offset: '50%', color: 'rgb(255,128,128)' },
    { offset: '100%', color: 'rgb(160,0,0)' },
  ]
}
