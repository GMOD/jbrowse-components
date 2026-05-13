// Local Source type for the synteny color/arrangement dialog. Mirrors the
// shape used in plugins/wiggle's MultiLinearWiggleDisplay dialog so the
// copied sub-components stay nearly identical, but adds `label` for the
// display-name override that synteny rows support.
export interface Source {
  name: string
  color?: string
  label?: string
  [k: string]: unknown
}
