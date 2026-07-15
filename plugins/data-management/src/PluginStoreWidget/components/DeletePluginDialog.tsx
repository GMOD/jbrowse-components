import { ConfirmDialog } from '@jbrowse/core/ui'
import { Typography } from '@mui/material'

export default function DeletePluginDialog({
  onClose,
  plugin,
}: {
  plugin: string
  onClose: (s?: string) => void
}) {
  return (
    <ConfirmDialog
      open
      title={`Remove ${plugin}`}
      submitText="Remove"
      submitColor="error"
      onCancel={() => {
        onClose()
      }}
      onSubmit={() => {
        // delay so the runtime plugin warning doesn't flash before unmount
        window.setTimeout(() => {
          onClose(plugin)
        }, 500)
      }}
    >
      <Typography>Please confirm that you want to remove {plugin}.</Typography>
      <Typography color="error">
        Note: if any resources in this session still use this plugin, it may
        cause your session to crash
      </Typography>
    </ConfirmDialog>
  )
}
