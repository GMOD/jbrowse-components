import CloseIcon from '@mui/icons-material/Close'
import {
  Autocomplete,
  IconButton,
  ListItemText,
  MenuItem,
  TextField,
} from '@mui/material'

import {
  OPERATORS,
  stripJexlPrefix,
  typedField,
  withField,
  withOp,
} from '../util/jexlFilterRows.ts'
import { makeStyles } from '../util/tss-react/index.ts'
import MonospaceTextField from './MonospaceTextField.tsx'

import type {
  ConditionRow,
  FieldChoice,
  RowOp,
  TextRow,
} from '../util/jexlFilterRows.ts'
import type { Jexl } from '@jbrowse/jexl'

const useStyles = makeStyles()(theme => ({
  row: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1),
  },
  field: {
    width: 220,
    flexShrink: 0,
  },
  op: {
    width: 130,
    flexShrink: 0,
  },
  value: {
    flex: 1,
  },
  expression: {
    width: 24,
    flexShrink: 0,
    textAlign: 'center',
    fontStyle: 'italic',
    fontFamily: 'serif',
    fontSize: 18,
    paddingTop: 6,
    color: theme.palette.text.secondary,
  },
}))

export function compileError(line: string, jexl: Pick<Jexl, 'compile'>) {
  try {
    jexl.compile(stripJexlPrefix(line.trim()))
    return undefined
  } catch (e) {
    return e instanceof Error ? e.message : String(e)
  }
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <IconButton size="small" aria-label="Remove condition" onClick={onClick}>
      <CloseIcon fontSize="small" />
    </IconButton>
  )
}

function ValueInput({
  row,
  onChange,
}: {
  row: ConditionRow
  onChange: (row: ConditionRow) => void
}) {
  const { classes } = useStyles()
  const { field, op, value } = row
  if (op === 'set' || op === '!set') {
    return <div className={classes.value} />
  }
  const suggestions = field?.values ?? []
  if (op === 'in') {
    return (
      <Autocomplete
        className={classes.value}
        size="small"
        multiple
        freeSolo
        autoSelect
        options={suggestions}
        value={[value].flat()}
        onChange={(_, next) => {
          onChange({ ...row, value: next })
        }}
        renderInput={params => (
          <TextField {...params} placeholder="Values, Enter after each" />
        )}
      />
    )
  }
  const text = [value].flat()[0] ?? ''
  return suggestions.length > 0 && op !== '~' ? (
    <Autocomplete
      className={classes.value}
      size="small"
      freeSolo
      options={suggestions}
      inputValue={text}
      onInputChange={(_, next) => {
        onChange({ ...row, value: next })
      }}
      renderInput={params => <TextField {...params} placeholder="Value" />}
    />
  ) : (
    <TextField
      className={classes.value}
      size="small"
      placeholder={op === '~' ? 'Regular expression' : 'Value'}
      type={field?.type === 'number' ? 'number' : 'text'}
      disabled={!field}
      value={text}
      onChange={event => {
        onChange({ ...row, value: event.target.value })
      }}
    />
  )
}

export function ConditionRowEditor({
  row,
  choices,
  onChange,
  onRemove,
}: {
  row: ConditionRow
  choices: FieldChoice[]
  onChange: (row: ConditionRow) => void
  onRemove: () => void
}) {
  const { classes } = useStyles()
  const { field } = row
  const grouped = choices.some(choice => choice.group)
  return (
    <div className={classes.row}>
      <Autocomplete<FieldChoice, false, false, true>
        className={classes.field}
        size="small"
        freeSolo
        autoSelect
        options={choices}
        groupBy={grouped ? choice => choice.group ?? '' : undefined}
        getOptionLabel={choice =>
          typeof choice === 'string' ? choice : choice.label
        }
        getOptionKey={choice =>
          typeof choice === 'string' ? choice : choice.key
        }
        isOptionEqualToValue={(a, b) =>
          typeof b !== 'string' && a.key === b.key
        }
        value={field ?? null}
        onChange={(_, next) => {
          const chosen =
            typeof next !== 'string'
              ? next
              : next === field?.label
                ? field
                : (choices.find(choice => choice.label === next) ??
                  typedField(next))
          if (chosen && chosen.key !== field?.key) {
            onChange(withField(row, chosen))
          }
        }}
        renderOption={({ key, ...props }, choice) => (
          <li key={key} {...props}>
            <ListItemText
              primary={choice.label}
              secondary={choice.description}
            />
          </li>
        )}
        renderInput={params => <TextField {...params} placeholder="Field" />}
      />
      <TextField
        className={classes.op}
        select
        size="small"
        disabled={!field}
        value={row.op}
        helperText={field?.multi ? 'any value' : undefined}
        onChange={event => {
          onChange(withOp(row, event.target.value as RowOp))
        }}
      >
        {OPERATORS[field?.type ?? 'any'].map(({ op, label }) => (
          <MenuItem key={op} value={op}>
            {label}
          </MenuItem>
        ))}
      </TextField>
      <ValueInput row={row} onChange={onChange} />
      <RemoveButton onClick={onRemove} />
    </div>
  )
}

export function TextRowEditor({
  row,
  jexl,
  onChange,
  onRemove,
}: {
  row: TextRow
  jexl: Pick<Jexl, 'compile'>
  onChange: (row: TextRow) => void
  onRemove: () => void
}) {
  const { classes } = useStyles()
  return (
    <div className={classes.row}>
      <div
        className={classes.expression}
        title="An expression the field pickers cannot show"
      >
        ƒ
      </div>
      <MonospaceTextField
        className={classes.value}
        variant="standard"
        fullWidth
        value={row.text}
        error={compileError(row.text, jexl)}
        onChange={text => {
          onChange({ ...row, text })
        }}
      />
      <RemoveButton onClick={onRemove} />
    </div>
  )
}
