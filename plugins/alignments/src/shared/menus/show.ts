import VisibilityIcon from '@mui/icons-material/Visibility'

interface ShowMenuModel {
  showSoftClipping: boolean
  mismatchAlpha?: boolean
  showCoverage: boolean
  showArcs: boolean
  pairedArcsDown: boolean
  showSashimiArcs: boolean
  sashimiArcsDown: boolean
  showMismatches: boolean
  showInterbaseIndicators: boolean
  showOutlineSetting: boolean
  showLinkedReads: boolean
  showLinkedReadsAsBeziers: boolean
  flipStrandLongReadChains: boolean
  toggleSoftClipping: () => void
  toggleMismatchAlpha: () => void
  setShowCoverage: (show: boolean) => void
  setShowArcs: (show: boolean) => void
  setPairedArcsDown: (flag: boolean) => void
  setShowSashimiArcs: (show: boolean) => void
  setSashimiArcsDown: (flag: boolean) => void
  setShowMismatches: (show: boolean) => void
  setShowInterbaseIndicators: (show: boolean) => void
  setShowOutline: (show: boolean) => void
  setShowLinkedReads: (show: boolean) => void
  setShowLinkedReadsAsBeziers: (show: boolean) => void
  setFlipStrandLongReadChains: (flip: boolean) => void
  setMaxHeight: (n?: number) => void
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
        label: 'Show mismatches faded by quality',
        type: 'checkbox' as const,
        checked: !!model.mismatchAlpha,
        onClick: () => {
          model.toggleMismatchAlpha()
        },
      },
      {
        label: 'Show coverage',
        type: 'checkbox' as const,
        checked: model.showCoverage,
        onClick: () => {
          model.setShowCoverage(!model.showCoverage)
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
      {
        label: 'Show interbase indicators',
        type: 'checkbox' as const,
        checked: model.showInterbaseIndicators,
        onClick: () => {
          model.setShowInterbaseIndicators(!model.showInterbaseIndicators)
        },
      },
      {
        label: 'Show outline on reads',
        type: 'checkbox' as const,
        checked: model.showOutlineSetting,
        onClick: () => {
          model.setShowOutline(!model.showOutlineSetting)
        },
      },
      {
        label: 'Show paired/supplementary reads as linked',
        type: 'checkbox' as const,
        checked: model.showLinkedReads,
        onClick: () => {
          model.setShowLinkedReads(!model.showLinkedReads)
        },
      },
      ...(model.showLinkedReads
        ? [
            {
              label: 'Show linked reads as bezier arcs',
              type: 'checkbox' as const,
              checked: model.showLinkedReadsAsBeziers,
              onClick: () => {
                model.setShowLinkedReadsAsBeziers(
                  !model.showLinkedReadsAsBeziers,
                )
              },
            },
          ]
        : []),
      {
        label: 'Show long read strand relative to primary',
        type: 'checkbox' as const,
        checked: model.flipStrandLongReadChains,
        onClick: () => {
          model.setFlipStrandLongReadChains(!model.flipStrandLongReadChains)
        },
      },
    ],
  }
}
