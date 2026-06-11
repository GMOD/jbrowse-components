import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { plural } from './util.ts'

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
          {orphanIndexCount} index {plural(orphanIndexCount, 'file', 'files')}{' '}
          had no matching data file and{' '}
          {plural(orphanIndexCount, 'was', 'were')} ignored
        </Typography>
      ) : null}
      {warnings.map(warning => (
        <Typography key={warning} variant="body2" color="warning">
          {warning}
        </Typography>
      ))}
      {skippedCount > 0 ? (
        <Typography variant="body2" color="error">
          {skippedCount} {plural(skippedCount, 'row', 'rows')} with unrecognized
          types will not be added
        </Typography>
      ) : null}
    </>
  )
})

export default PreviewMessages
