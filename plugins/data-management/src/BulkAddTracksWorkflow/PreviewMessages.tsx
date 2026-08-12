import { pluralize } from '@jbrowse/core/util'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

const PreviewMessages = observer(function PreviewMessages({
  orphanIndexCount,
  warnings,
  skippedCount,
}: {
  orphanIndexCount: number
  warnings: string[]
  skippedCount: number
}) {
  return (
    <>
      {orphanIndexCount > 0 ? (
        <Typography variant="body2" color="textSecondary">
          {orphanIndexCount} index {pluralize(orphanIndexCount, 'file')} had no
          matching data file and {pluralize(orphanIndexCount, 'was', 'were')}{' '}
          ignored
        </Typography>
      ) : null}
      {warnings.map(warning => (
        <Typography key={warning} variant="body2" color="warning">
          {warning}
        </Typography>
      ))}
      {skippedCount > 0 ? (
        <Typography variant="body2" color="error">
          {skippedCount} {pluralize(skippedCount, 'row')} with unrecognized
          types will not be added
        </Typography>
      ) : null}
    </>
  )
})

export default PreviewMessages
