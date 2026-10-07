import { LabeledCheckbox } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

const useStyles = makeStyles()({
  row: {
    alignItems: 'flex-start',
    marginTop: 8,
  },
})

const PreferenceCheckbox = observer(function PreferenceCheckbox({
  checked,
  label,
  help,
  onChange,
}: {
  checked: boolean
  label: string
  help?: string
  onChange: (checked: boolean) => void
}) {
  const { classes } = useStyles()
  return (
    <LabeledCheckbox
      className={classes.row}
      checked={checked}
      onChange={checked => {
        onChange(checked)
      }}
      label={
        <>
          <Typography>{label}</Typography>
          {help ? (
            <Typography variant="body2" color="text.secondary">
              {help}
            </Typography>
          ) : null}
        </>
      }
    />
  )
})

export default PreferenceCheckbox
