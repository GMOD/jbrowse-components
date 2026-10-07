import { observer } from 'mobx-react'

import InfoDialog from './InfoDialog.tsx'

const CascadingMenuHelpDialog = observer(function CascadingMenuHelpDialog({
  onClose,
  helpText,
  label,
}: {
  onClose: () => void
  helpText: React.ReactNode
  label?: React.ReactNode
}) {
  return (
    <InfoDialog
      open
      onClose={onClose}
      title="Help"
      titleNode={label ? <>Help: {label}</> : undefined}
      onClick={e => {
        e.stopPropagation()
      }}
      onMouseDown={e => {
        e.stopPropagation()
      }}
    >
      {helpText}
    </InfoDialog>
  )
})

export default CascadingMenuHelpDialog
