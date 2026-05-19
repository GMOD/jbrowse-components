import type { MenuItem } from '@jbrowse/core/ui'

const SNP_BP_PER_PX_VALUES = [10, 50, 100, 500, 1000] as const

interface SnpThresholdModel {
  snpBpPerPxThreshold: number
  setSnpBpPerPxThreshold: (t: number) => void
}

export function getSnpThresholdMenuItem(model: SnpThresholdModel): MenuItem {
  return {
    label: 'SNP detail threshold',
    subMenu: [
      {
        label: 'Off',
        type: 'radio' as const,
        checked: model.snpBpPerPxThreshold === 0,
        onClick: () => {
          model.setSnpBpPerPxThreshold(0)
        },
      },
      ...SNP_BP_PER_PX_VALUES.map(t => ({
        label: `${t} bp/px`,
        type: 'radio' as const,
        checked: model.snpBpPerPxThreshold === t,
        onClick: () => {
          model.setSnpBpPerPxThreshold(t)
        },
      })),
    ],
  }
}
