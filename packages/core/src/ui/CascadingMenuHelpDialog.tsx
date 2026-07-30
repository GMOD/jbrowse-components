import InfoDialog from './InfoDialog.tsx'

export default function CascadingMenuHelpDialog({
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
}
