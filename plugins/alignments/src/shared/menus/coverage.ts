import { lazy } from 'react'

import { getSession } from '@jbrowse/core/util'
import {
  makeAutoscaleTypeSubMenu,
  makeScaleTypeSubMenu,
} from '@jbrowse/wiggle-core'
import EqualizerIcon from '@mui/icons-material/Equalizer'

const SetMinMaxDialog = lazy(() =>
  import('@jbrowse/wiggle-core').then(m => ({ default: m.SetMinMaxDialog })),
)

interface CoverageModel {
  showCoverage: boolean
  setShowCoverage: (show: boolean) => void

  coverageScaleType: string
  setCoverageScaleType: (val: string) => void
  coverageAutoscaleType: string
  setCoverageAutoscaleType: (val: string) => void
  coverageMinScore?: number
  coverageMaxScore?: number
  coverageNumStdDev: number
  setCoverageMinScore: (v?: number) => void
  setCoverageMaxScore: (v?: number) => void

  showYScalebar: boolean
  setShowYScalebar: (show: boolean) => void
}

// Shape the alignments coverage fields into the canonical
// min/max/scaleType + setters interface that wiggle-core's
// SetMinMaxDialog expects. We disambiguate with "coverage*" on the model
// (so it doesn't collide with non-coverage min/max), then unwrap here.
function adaptForMinMaxDialog(model: CoverageModel) {
  return {
    minScore: model.coverageMinScore ?? Number.MIN_VALUE,
    maxScore: model.coverageMaxScore ?? Number.MAX_VALUE,
    scaleType: model.coverageScaleType,
    setMinScore: model.setCoverageMinScore,
    setMaxScore: model.setCoverageMaxScore,
  }
}

// Adapter: alignments stores coverage scale/autoscale on `coverage*`
// prefixed fields; the shared wiggle-core menu helpers expect the
// canonical names. Re-aliases the getters and setters.
function adaptForScaleMenus(model: CoverageModel) {
  return {
    scaleType: model.coverageScaleType,
    autoscaleType: model.coverageAutoscaleType,
    setScaleType: model.setCoverageScaleType,
    setAutoscale: (val?: string) => {
      if (val !== undefined) {
        model.setCoverageAutoscaleType(val)
      }
    },
  }
}

// Single "Coverage" submenu collecting on/off, scale type, autoscale, the
// min/max range dialog, and the Y-axis labels toggle — all the settings
// that determine how the coverage band looks. Replaces the bare "Coverage"
// submenu (which used to hold only the on/off checkbox) plus the coverage
// half of the old "Advanced..." dialog.
export function getCoverageMenuItem(model: CoverageModel) {
  const sigma = model.coverageNumStdDev
  const scaleAdapter = adaptForScaleMenus(model)
  return {
    label: 'Coverage',
    icon: EqualizerIcon,
    type: 'subMenu' as const,
    subMenu: [
      {
        label: 'Show coverage',
        type: 'checkbox' as const,
        checked: model.showCoverage,
        onClick: () => {
          model.setShowCoverage(!model.showCoverage)
        },
      },
      {
        label: 'Show Y-axis labels',
        type: 'checkbox' as const,
        checked: model.showYScalebar,
        onClick: () => {
          model.setShowYScalebar(!model.showYScalebar)
        },
      },
      makeScaleTypeSubMenu(scaleAdapter),
      makeAutoscaleTypeSubMenu(scaleAdapter, [
        ['local', 'Local'],
        ['localsd', `Local ± ${sigma}σ`],
      ]),
      {
        label: 'Set min/max score',
        onClick: () => {
          getSession(model).queueDialog(handleClose => [
            SetMinMaxDialog,
            { model: adaptForMinMaxDialog(model), handleClose },
          ])
        },
      },
    ],
  }
}
