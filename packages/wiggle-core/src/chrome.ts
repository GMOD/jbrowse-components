// What draws a score plot, kept out of the package entry so the entry's score
// math and config mixins stay real in the RPC worker. A display imports these;
// an adapter or an RPC method never does.
export {
  AxisGutter,
  CrossHatchLines,
  CrossHatches,
  ScoreDomainCaption,
  ScoreRuleLines,
  ScoreRules,
  YScaleBar,
  YScaleBarOverlay,
} from '@jbrowse/display-ui'

export { makeResolutionSubMenuItem } from './ResolutionStepper.tsx'
export { makePointSizeSubMenu, pointSizeAccess } from './pointSizeMenu.tsx'
export type { PointSizeAccess } from './pointSizeMenu.tsx'
export { default as SetMinMaxDialog } from './SetMinMaxDialog.tsx'
