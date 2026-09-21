import { use, useState } from 'react'

import { getEnv } from '@jbrowse/mobx-state-tree'
import AddIcon from '@mui/icons-material/Add'
import {
  Button,
  ListItemText,
  MenuItem,
  Tab,
  Tabs,
  TextField,
} from '@mui/material'
import { observer } from 'mobx-react'

import { readConfObject } from '../configuration/readConfObject.ts'
import {
  addRow,
  describedColumns,
  readFilterRows,
  removeRow,
  replaceRow,
  resolveFields,
  stripJexlPrefix,
  writeFilterRows,
} from '../util/jexlFilterRows.ts'
import { activeJexlFilters } from '../util/jexlFilters.ts'
import { ensureJexlPrefix } from '../util/jexlStrings.ts'
import { getContainingTrack } from '../util/mstUtils.ts'
import { makeStyles } from '../util/tss-react/index.ts'
import ExternalLink from './ExternalLink.tsx'
import {
  ConditionRowEditor,
  TextRowEditor,
  compileError,
} from './JexlFilterRowEditors.tsx'
import MonospaceTextField from './MonospaceTextField.tsx'
import SubmitDialog from './SubmitDialog.tsx'

import type { FilterRows, JexlFilterField } from '../util/jexlFilterRows.ts'
import type { JexlFilterModel } from '../util/jexlFilters.ts'
import type { Jexl } from '@jbrowse/jexl'

export type { JexlFilterField } from '../util/jexlFilterRows.ts'

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
  tabs: {
    marginBottom: theme.spacing(2),
  },
  hint: {
    marginBottom: theme.spacing(2),
    color: theme.palette.text.secondary,
  },
  examples: {
    minWidth: 220,
    marginBottom: theme.spacing(1),
  },
}))

function textLines(text: string) {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => !!line)
    .map(ensureJexlPrefix)
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

function withOneRow(state: FilterRows) {
  return state.rows.length > 0 ? state : addRow(state)
}

/**
 * Editor for a display's jexl feature filters, for any display implementing
 * the two-tier {@link JexlFilterModel} contract. The Conditions tab shows each
 * line as rows of field, operator and value where it can, and as text where it
 * cannot; the Text tab is every line as text.
 *
 * `fields` lists what the field picker offers, then the columns `metadata`
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
  const [choices] = useState(() =>
    resolveFields([...fieldList, ...describedColumns(described, fieldList)]),
  )
  const [state, setState] = useState(() =>
    withOneRow(readFilterRows(activeJexlFilters(model), jexl, choices)),
  )
  const [tab, setTab] = useState<'conditions' | 'text'>('conditions')
  const [text, setText] = useState({ value: '', shown: '' })
  const textEdited = text.value !== text.shown
  const error =
    tab === 'text'
      ? textError(text.value, jexl)
      : state.rows.some(
          row => row.kind === 'text' && compileError(row.text, jexl),
        )
  const name = trackName(model)

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
        // An emptied list is "show everything", which is NOT the same as
        // following the config slot, so it is set as an override too
        model.setJexlFilters(
          tab === 'text' && textEdited
            ? textLines(text.value)
            : writeFilterRows(state),
        )
        handleClose()
      }}
    >
      <div className={classes.body}>
        <Tabs
          className={classes.tabs}
          value={tab}
          onChange={(_, next: 'conditions' | 'text') => {
            if (next === 'text') {
              const value = writeFilterRows(state)
                .map(stripJexlPrefix)
                .join('\n')
              setText({ value, shown: value })
            } else if (textEdited) {
              setState(
                withOneRow(
                  readFilterRows(textLines(text.value), jexl, choices),
                ),
              )
            }
            setTab(next)
          }}
        >
          <Tab value="conditions" label="Conditions" />
          <Tab value="text" label="Text" data-testid="jexl-filter-text-tab" />
        </Tabs>
        {tab === 'conditions' ? (
          <>
            <div className={classes.hint}>
              Show features that match every condition.
            </div>
            {state.rows.map(row =>
              row.kind === 'text' ? (
                <TextRowEditor
                  key={row.id}
                  row={row}
                  jexl={jexl}
                  onChange={next => {
                    setState(replaceRow(state, next))
                  }}
                  onRemove={() => {
                    setState(removeRow(state, row.id))
                  }}
                />
              ) : (
                <ConditionRowEditor
                  key={row.id}
                  row={row}
                  choices={choices}
                  onChange={next => {
                    setState(replaceRow(state, next))
                  }}
                  onRemove={() => {
                    setState(removeRow(state, row.id))
                  }}
                />
              ),
            )}
            <Button
              startIcon={<AddIcon />}
              onClick={() => {
                setState(addRow(state))
              }}
            >
              Add condition
            </Button>
          </>
        ) : (
          <>
            <TextField
              select
              size="small"
              label="Insert example…"
              value=""
              className={classes.examples}
              onChange={event => {
                const code = stripJexlPrefix(event.target.value)
                setText({
                  ...text,
                  value: text.value.trim()
                    ? `${text.value.trimEnd()}\n${code}`
                    : code,
                })
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
            <MonospaceTextField
              fullWidth
              minRows={6}
              maxRows={14}
              value={text.value}
              error={error}
              helperText="One filter per line; a feature has to pass every line."
              onChange={value => {
                setText({ ...text, value })
              }}
            />
            <p>
              See the{' '}
              <ExternalLink href="https://jbrowse.org/jb2/docs/config_guides/jexl/">
                jexl documentation
              </ExternalLink>{' '}
              for the expression language.
            </p>
          </>
        )}
      </div>
    </SubmitDialog>
  )
})

export default JexlFilterDialog
