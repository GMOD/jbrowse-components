import { lazy } from 'react'

import { getSession } from '@jbrowse/core/util'
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

// Single "Coverage" submenu collecting on/off, scale type, autoscale, the
// min/max range dialog, and the Y-axis labels toggle — all the settings
// that determine how the coverage band looks. Replaces the bare "Coverage"
// submenu (which used to hold only the on/off checkbox) plus the coverage
// half of the old "Advanced..." dialog.
export function getCoverageMenuItem(model: CoverageModel) {
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
      {
        label: 'Scale',
        type: 'subMenu' as const,
        subMenu: [
          {
            label: 'Linear',
            type: 'radio' as const,
            checked: model.coverageScaleType === 'linear',
            onClick: () => {
              model.setCoverageScaleType('linear')
            },
          },
          {
            label: 'Log',
            type: 'radio' as const,
            checked: model.coverageScaleType === 'log',
            onClick: () => {
              model.setCoverageScaleType('log')
            },
          },
        ],
      },
      {
        label: 'Autoscale',
        type: 'subMenu' as const,
        subMenu: [
          {
            label: 'Local',
            type: 'radio' as const,
            checked: model.coverageAutoscaleType === 'local',
            onClick: () => {
              model.setCoverageAutoscaleType('local')
            },
          },
          {
            label: 'Local ± 3σ',
            type: 'radio' as const,
            checked: model.coverageAutoscaleType === 'localsd',
            onClick: () => {
              model.setCoverageAutoscaleType('localsd')
            },
          },
        ],
      },
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
