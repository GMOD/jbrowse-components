import { LabeledCheckbox } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Typography } from '@mui/material'

const useStyles = makeStyles()({
  row: {
    alignItems: 'flex-start',
    marginTop: 8,
  },
})

export default function PreferenceCheckbox({
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
}
