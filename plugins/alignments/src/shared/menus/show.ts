import VisibilityIcon from '@mui/icons-material/Visibility'

interface ShowMenuModel {
  showSoftClipping: boolean
  showMismatches: boolean
  toggleSoftClipping: () => void
  setShowMismatches: (show: boolean) => void
}

export function getShowMenuItem(model: ShowMenuModel) {
  return {
    label: 'Show...',
    icon: VisibilityIcon,
    subMenu: [
      {
        label: 'Show soft clipping',
        type: 'checkbox' as const,
        checked: model.showSoftClipping,
        onClick: () => {
          model.toggleSoftClipping()
        },
      },
      {
        label: 'Show mismatches',
        type: 'checkbox' as const,
        checked: model.showMismatches,
        onClick: () => {
          model.setShowMismatches(!model.showMismatches)
        },
      },
    ],
  }
}
