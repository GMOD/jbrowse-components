import type { MenuItem } from '@jbrowse/core/ui'

export const colorByOptions = ['strand', 'syri', 'identity'] as const

interface ColorByModel {
  colorBy: string
  setColorBy: (option: string) => void
}

export function getColorByMenuItem(model: ColorByModel): MenuItem {
  return {
    label: 'Color by',
    subMenu: colorByOptions.map(option => ({
      label: option,
      type: 'radio' as const,
      checked: model.colorBy === option,
      onClick: () => {
        model.setColorBy(option)
      },
    })),
  }
}
