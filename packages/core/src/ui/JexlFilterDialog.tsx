import { use, useRef, useState } from 'react'

import { getEnv } from '@jbrowse/mobx-state-tree'
import { Autocomplete, ListItemText, MenuItem, TextField } from '@mui/material'
import { observer } from 'mobx-react'

import { readConfObject } from '../configuration/readConfObject.ts'
import {
  describedColumns,
  fieldExpression,
  stripJexlPrefix,
} from '../util/jexlFilterFields.ts'
import { ensureJexlPrefix } from '../util/jexlStrings.ts'
import { getContainingTrack } from '../util/mstUtils.ts'
import { makeStyles } from '../util/tss-react/index.ts'
import ExternalLink from './ExternalLink.tsx'
import MonospaceTextField from './MonospaceTextField.tsx'
import SubmitDialog from './SubmitDialog.tsx'

import type { JexlFilterField } from '../util/jexlFilterFields.ts'
import type { JexlFilterModel } from '../util/jexlFilters.ts'
import type { Jexl } from '@jbrowse/jexl'

export type { JexlFilterField } from '../util/jexlFilterFields.ts'

export interface JexlFilterExample {
  code: string
  description: string
}

/**
 * What a display filtering plain annotation features offers as a starting
 * point. A display whose features are a richer record — a VCF, say — passes its
 * own list instead: the examples are the only place the dialog says what is
 * readable off a feature, so a variant track showing `type=='gene'` is teaching
 * the wrong vocabulary.
 */
const FEATURE_FILTER_EXAMPLES: JexlFilterExample[] = [
  {
    code: "jexl:get(feature,'name')=='BRCA1'",
    description: 'show only features where the name attribute is BRCA1',
  },
  {
    code: "jexl:startsWith(get(feature,'name'),'PREFIX')",
    description:
      "show only features where the string 'PREFIX' is the prefix of the feature name. endsWith also works",
  },
  {
    code: "jexl:includes(get(feature,'name'),'PREFIX')",
    description:
      "show only features where the string 'PREFIX' appears in the feature name",
  },
  {
    code: "jexl:get(feature,'type')=='gene'",
    description:
      'show only gene type features in a GFF that has many other feature types',
  },
  {
    code: "jexl:get(feature,'score') > 400",
    description: 'show only features that have a score greater than 400',
  },
  {
    code: "jexl:get(feature,'end') - get(feature,'start') < 1000000",
    description: 'show only features with length less than 1Mbp',
  },
]

const FEATURE_FIELDS: JexlFilterField[] = [
  { label: 'name', path: ['name'], type: 'text' },
  { label: 'type', path: ['type'], type: 'text' },
  { label: 'score', path: ['score'], type: 'number' },
  { label: 'start', path: ['start'], type: 'number' },
  { label: 'end', path: ['end'], type: 'number' },
  { label: 'strand', path: ['strand'], type: 'number' },
]

const useStyles = makeStyles()(theme => ({
  body: {
    minHeight: 280,
  },
  pickers: {
    display: 'flex',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1),
  },
  picker: {
    minWidth: 220,
  },
}))

function textLines(text: string) {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => !!line)
    .map(ensureJexlPrefix)
}

function compileError(line: string, jexl: Pick<Jexl, 'compile'>) {
  try {
    jexl.compile(stripJexlPrefix(line.trim()))
    return undefined
  } catch (e) {
    return e instanceof Error ? e.message : String(e)
  }
}

function textError(text: string, jexl: Jexl) {
  for (const [i, line] of text.split('\n').entries()) {
    const error = line.trim() ? compileError(line, jexl) : undefined
    if (error) {
      return `Line ${i + 1}: ${error}`
    }
  }
  return undefined
}

function trackName(model: JexlFilterModel) {
  try {
    return readConfObject(getContainingTrack(model).configuration, 'name') as
      | string
      | undefined
  } catch {
    return undefined
  }
}

function fieldHint({ description, values }: JexlFilterField) {
  return (
    [description, values?.length ? `one of ${values.join(', ')}` : undefined]
      .filter(Boolean)
      .join('; ') || undefined
  )
}

/**
 * Editor for a display's jexl feature filters, one expression per line, for
 * any display implementing the {@link JexlFilterModel} contract.
 *
 * `fields` lists what the field picker inserts, then the columns `metadata`
 * describes, if it is an adapter's `{column: description}` map. Either one
 * given as a promise suspends the dialog until it resolves, so it must not
 * reject.
 */
const JexlFilterDialog = observer(function JexlFilterDialog({
  model,
  handleClose,
  examples = FEATURE_FILTER_EXAMPLES,
  fields = FEATURE_FIELDS,
  metadata,
}: {
  model: JexlFilterModel
  handleClose: () => void
  examples?: JexlFilterExample[]
  fields?: JexlFilterField[] | Promise<JexlFilterField[]>
  metadata?: Promise<unknown>
}) {
  const { classes } = useStyles()
  const jexl = getEnv<{ pluginManager: { jexl: Jexl } }>(model).pluginManager
    .jexl
  const fieldList = fields instanceof Promise ? use(fields) : fields
  const described = metadata && use(metadata)
  const [choices] = useState(() => [
    ...fieldList,
    ...describedColumns(described, fieldList),
  ])
  const [text, setText] = useState(() =>
    model.configuredFilters().map(stripJexlPrefix).join('\n'),
  )
  const box = useRef<HTMLTextAreaElement>(null)
  const error = textError(text, jexl)
  const name = trackName(model)
  const grouped = choices.some(choice => choice.group)

  return (
    <SubmitDialog
      maxWidth="md"
      fullWidth
      open
      title={name ? `Filter ${name}` : 'Filter features'}
      submitText="Apply"
      submitDisabled={!!error}
      onCancel={handleClose}
      onSubmit={() => {
        // an emptied list means "show everything", not "follow the config",
        // so it is set as an override too
        model.setFilter(textLines(text))
        handleClose()
      }}
    >
      <div className={classes.body}>
        <div className={classes.pickers}>
          <Autocomplete<JexlFilterField>
            className={classes.picker}
            size="small"
            blurOnSelect
            options={choices}
            value={null}
            groupBy={grouped ? choice => choice.group ?? '' : undefined}
            getOptionLabel={choice => choice.label}
            getOptionKey={fieldExpression}
            onChange={(_, choice) => {
              if (choice) {
                const insert = fieldExpression(choice)
                const start = box.current?.selectionStart ?? text.length
                const end = box.current?.selectionEnd ?? text.length
                setText(text.slice(0, start) + insert + text.slice(end))
              }
            }}
            renderOption={({ key, ...props }, choice) => (
              <li key={key} {...props}>
                <ListItemText
                  primary={choice.label}
                  secondary={fieldHint(choice)}
                />
              </li>
            )}
            renderInput={params => (
              <TextField {...params} label="Insert field…" />
            )}
          />
          <TextField
            select
            size="small"
            label="Insert example…"
            value=""
            className={classes.picker}
            onChange={event => {
              const code = stripJexlPrefix(event.target.value)
              setText(text.trim() ? `${text.trimEnd()}\n${code}` : code)
            }}
          >
            {examples.map(({ code, description }) => (
              <MenuItem key={code} value={code}>
                <ListItemText
                  primary={stripJexlPrefix(code)}
                  secondary={description}
                />
              </MenuItem>
            ))}
          </TextField>
        </div>
        <MonospaceTextField
          fullWidth
          minRows={6}
          maxRows={14}
          inputRef={box}
          inputTestId="jexl-filter-text"
          value={text}
          error={error}
          helperText="One filter per line; a feature has to pass every line."
          onChange={setText}
        />
        <p>
          See the{' '}
          <ExternalLink href="https://jbrowse.org/jb2/docs/config_guides/jexl/">
            jexl documentation
          </ExternalLink>{' '}
          for the expression language.
        </p>
      </div>
    </SubmitDialog>
  )
})

export default JexlFilterDialog
