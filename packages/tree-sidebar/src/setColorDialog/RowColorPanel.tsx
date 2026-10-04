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
 * The `unknown` swatch: the one colour every row or value no swatch of its own
 * names takes, or automatic, which is the palette where it deals and the row's
 * own colour otherwise. `count` is the rows it paints, where that is known.
 */
export interface OtherColor {
  color: string | undefined
  count?: number
  onChange: (color: string) => void
  onClear: () => void
}

function rowCount(count: number) {
  return `${count.toLocaleString()} ${count === 1 ? 'row' : 'rows'}`
}

/**
 * What the rows are coloured by, above the rows: no palette, a palette colour
 * each where the display deals one, or an attribute, whose values are listed
 * with their colours to edit.
 */
export default function RowColorPanel({
  eachRow,
  fields,
  choice,
  values,
  other,
  onChoice,
  onValueColor,
  onResetValues,
  onStartFrom,
  onClearRows,
}: {
  eachRow: boolean
  fields: readonly string[]
  choice: string
  values: ValueColor[]
  // Undefined where the choice fixes `unknown`: None with a palette dealing.
  other?: OtherColor
  onChoice: (choice: string) => void
  onValueColor: (value: string, color: string) => void
  onResetValues: () => void
  onStartFrom: (field: string) => void
  onClearRows: () => void
}) {
  const { classes } = useStyles()
  const otherSwatch = other ? (
    <PopoverPicker
      color={other.color || 'auto'}
      unset={!other.color}
      onChange={other.onChange}
    />
  ) : null
  // The way back to automatic, which the picker itself has no entry for.
  const otherAuto = other?.color ? (
    <Button size="small" onClick={other.onClear}>
      Auto
    </Button>
  ) : null
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
            {choice === ''
              ? 'Rows show the colors their data gives them. Click a swatch in the list to color one row.'
              : 'Each row takes a palette color. Click a swatch in the list to change one.'}
          </Typography>
          {otherSwatch ? (
            <>
              {otherSwatch}
              <Typography variant="body2">Other rows</Typography>
              {otherAuto}
            </>
          ) : null}
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
                  {rowCount(count)}
                </Typography>
              </Fragment>
            ))}
            {other ? (
              <>
                {otherSwatch}
                <Typography variant="body2">Other values</Typography>
                <Typography variant="body2" color="textSecondary">
                  {other.count === undefined ? '' : rowCount(other.count)}
                  {otherAuto}
                </Typography>
              </>
            ) : null}
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
