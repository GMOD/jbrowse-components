import { Fragment } from 'react'

import PopoverPicker from '@jbrowse/core/ui/PopoverPicker'
import { capitalizeFirst } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  Button,
  MenuItem,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'

const useStyles = makeStyles()(theme => ({
  panel: {
    display: 'grid',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(2),
  },
  line: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  values: {
    display: 'grid',
    gridTemplateColumns: 'auto auto 1fr',
    alignItems: 'center',
    columnGap: theme.spacing(2),
    rowGap: theme.spacing(0.5),
    maxHeight: 220,
    overflowY: 'auto',
  },
}))

export interface ValueColor {
  value: string
  count: number
  color: string | undefined
}

/**
 * What the rows are coloured by, above the rows: no palette, a palette colour
 * each where the display deals one, or an attribute, whose values are listed
 * with their colours to edit.
 */
export default function RowColorPanel({
  eachRow,
  keptUnknown,
  fields,
  choice,
  values,
  onChoice,
  onValueColor,
  onResetValues,
  onStartFrom,
  onClearRows,
}: {
  eachRow: boolean
  // The config's colour for the rows no pair names, which None keeps where no
  // palette deals.
  keptUnknown?: string
  fields: readonly string[]
  choice: string
  values: ValueColor[]
  onChoice: (choice: string) => void
  onValueColor: (value: string, color: string) => void
  onResetValues: () => void
  onStartFrom: (field: string) => void
  onClearRows: () => void
}) {
  const { classes } = useStyles()
  return (
    <div className={classes.panel}>
      <div className={classes.line}>
        <Typography variant="subtitle2">Color rows by</Typography>
        <ToggleButtonGroup
          exclusive
          size="small"
          sx={{ '& .MuiToggleButton-root': { textTransform: 'none' } }}
          value={choice}
          onChange={(_event, value: string | null) => {
            if (value !== null) {
              onChoice(value)
            }
          }}
        >
          <ToggleButton value="">None</ToggleButton>
          {eachRow ? <ToggleButton value="name">Each row</ToggleButton> : null}
          {fields.map(field => (
            <ToggleButton key={field} value={field}>
              {capitalizeFirst(field)}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </div>
      {choice === '' || choice === 'name' ? (
        <div className={classes.line}>
          <Typography variant="body2" color="textSecondary">
            {choice !== ''
              ? 'Each row takes a palette color. Click a swatch in the list to change one.'
              : keptUnknown
                ? "Rows take the config's color for the unlisted. Click a swatch in the list to color one row."
                : 'Rows show the colors their data gives them. Click a swatch in the list to color one row.'}
          </Typography>
          {fields.length ? (
            <TextField
              select
              size="small"
              variant="outlined"
              label="Start from"
              value=""
              sx={{ minWidth: 200 }}
              onChange={event => {
                onStartFrom(event.target.value)
              }}
            >
              {fields.map(field => (
                <MenuItem key={field} value={field}>
                  {capitalizeFirst(field)} colors
                </MenuItem>
              ))}
            </TextField>
          ) : null}
          <Button size="small" onClick={onClearRows}>
            Clear row colors
          </Button>
        </div>
      ) : (
        <>
          <div className={classes.values} data-testid="row-color-values">
            {values.map(({ value, count, color }) => (
              <Fragment key={value}>
                <PopoverPicker
                  color={color ?? 'auto'}
                  unset={!color}
                  onChange={next => {
                    onValueColor(value, next)
                  }}
                />
                <Typography variant="body2">{value || '(no value)'}</Typography>
                <Typography variant="body2" color="textSecondary">
                  {count.toLocaleString()} {count === 1 ? 'row' : 'rows'}
                </Typography>
              </Fragment>
            ))}
          </div>
          <div>
            <Button size="small" onClick={onResetValues}>
              Reset {capitalizeFirst(choice)} colors
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
