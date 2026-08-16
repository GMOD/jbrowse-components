import { pluralize } from '@jbrowse/core/util'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

const PreviewMessages = observer(function PreviewMessages({
  orphanIndexCount,
  warnings,
  skippedCount,
  needsSetupCount,
}: {
  orphanIndexCount: number
  warnings: string[]
  skippedCount: number
  needsSetupCount: number
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
      {needsSetupCount > 0 ? (
        <Typography variant="body2" color="warning">
          {needsSetupCount} {pluralize(needsSetupCount, 'row')}{' '}
          {pluralize(needsSetupCount, 'names', 'name')} a format whose assembly
          a filename cannot supply — a synteny file needs its assembly pair, not
          the one assembly chosen above — so{' '}
          {pluralize(needsSetupCount, 'it', 'they')} will not be added. Use the
          single-track workflow for {pluralize(needsSetupCount, 'it', 'them')}
        </Typography>
      ) : null}
    </>
  )
})

export default PreviewMessages
