import { useState } from 'react'

import {
  arraySlotUnion,
  getSlotDefinition,
  getTypeNamesFromExplicitlyTypedUnion,
  isConfigurationModel,
  isConfigurationSchemaType,
  isConfigurationSlot,
  makeSlotFacade,
  readConfObject,
  setConf,
} from '@jbrowse/core/configuration'
import SanitizedHTML from '@jbrowse/core/ui/SanitizedHTML'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { getMembers, getSnapshot } from '@jbrowse/mobx-state-tree'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ClearIcon from '@mui/icons-material/Clear'
import DeleteIcon from '@mui/icons-material/Delete'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import SearchIcon from '@mui/icons-material/Search'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Button,
  IconButton,
  InputAdornment,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import SlotEditor from './SlotEditor.tsx'
import TypeSelector from './TypeSelector.tsx'
import { singularSlotName } from './singularSlotName.ts'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { IAnyType } from '@jbrowse/mobx-state-tree'

const useStyles = makeStyles()(theme => ({
  icon: {
    color: theme.palette.tertiary.contrastText || '#fff',
  },
  expansionPanelDetails: {
    display: 'block',
    padding: theme.spacing(1),
  },
  accordion: {
    border: `1px solid ${theme.palette.text.primary}`,
  },
  noOverflow: {
    width: '100%',
    overflowX: 'auto',
  },
  filter: {
    margin: theme.spacing(1),
  },
  noResults: {
    margin: theme.spacing(2),
    fontStyle: 'italic',
  },
  advancedToggle: {
    margin: theme.spacing(1, 0),
    textTransform: 'none',
  },
  entryControls: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
}))

// The entries of an array of sub-schemas as snapshots, for a whole-list write.
function listSnapshot(schema: AnyConfigurationModel, listName: string) {
  return [...getSnapshot<readonly unknown[]>(schema[listName])]
}

interface UnionEntry {
  listName: string
  choices: string[]
  index: number
  count: number
}

// matches a slot or sub-schema against a lowercased filter string, recursing
// into sub-schemas so a nested slot name keeps its ancestors visible
function memberMatches(
  schema: AnyConfigurationModel,
  slotName: string,
  slotSchema: IAnyType,
  query: string,
): boolean {
  if (isConfigurationSlot(schema, slotName)) {
    const { description } = getSlotDefinition(schema, slotName)
    return (
      slotName.toLowerCase().includes(query) ||
      !!description?.toLowerCase().includes(query)
    )
  } else if (isConfigurationSchemaType(slotSchema)) {
    const slot = schema[slotName] as
      | AnyConfigurationModel
      | AnyConfigurationModel[]
      | undefined
    return (
      slotName.toLowerCase().includes(query) ||
      (Array.isArray(slot)
        ? slot.some(subslot => schemaMatches(subslot, query))
        : slot !== undefined && schemaMatches(slot, query))
    )
  } else {
    return false
  }
}

function schemaMatches(schema: AnyConfigurationModel, query: string): boolean {
  const { properties } = getMembers(schema)
  return Object.entries(properties).some(([slotName, slotSchema]) =>
    memberMatches(schema, slotName, slotSchema, query),
  )
}

// a slot flagged `advanced` in its schema definition, hidden behind a toggle
function isAdvancedSlot(
  schema: AnyConfigurationModel,
  slotName: string,
): boolean {
  return (
    isConfigurationSlot(schema, slotName) &&
    !!getSlotDefinition(schema, slotName).advanced
  )
}

// a display config is the only sub-schema carrying a displayId; when the editor
// was opened from a view, only the active display expands by default so the
// track's other (incompatible/inactive) displays don't crowd the panel
function displayDefaultExpanded(
  slot: AnyConfigurationModel,
  expandedDisplayId: string | undefined,
): boolean {
  const displayId = isConfigurationModel(slot)
    ? (readConfObject(slot, 'displayId') as string | undefined)
    : undefined
  return !displayId || !expandedDisplayId || displayId === expandedDisplayId
}

// A union list entry's own controls: its type, and its place in the list. Each
// is one whole-list write, so every state it leaves loads again.
const EntryControls = observer(function EntryControls({
  schema,
  title,
  slot,
  entry: { listName, choices, index, count },
}: {
  schema: AnyConfigurationModel
  title: string
  slot: AnyConfigurationModel
  entry: UnionEntry
}) {
  const { classes } = useStyles()
  const write = (edit: (entries: unknown[]) => unknown[]) => {
    setConf(schema, listName, edit(listSnapshot(schema, listName)))
  }
  const swap = (at: number) => {
    write(list => list.toSpliced(at, 2, list[at + 1], list[at]))
  }
  return (
    <>
      <div className={classes.entryControls}>
        <IconButton
          aria-label={`move ${title} up`}
          disabled={index === 0}
          onClick={() => {
            swap(index - 1)
          }}
        >
          <ArrowUpwardIcon fontSize="small" />
        </IconButton>
        <IconButton
          aria-label={`move ${title} down`}
          disabled={index === count - 1}
          onClick={() => {
            swap(index)
          }}
        >
          <ArrowDownwardIcon fontSize="small" />
        </IconButton>
        <IconButton
          aria-label={`remove ${title}`}
          onClick={() => {
            write(list => list.toSpliced(index, 1))
          }}
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
      </div>
      <TypeSelector
        typeNameChoices={choices}
        slotName={title}
        slot={slot}
        onChange={evt => {
          const type = evt.target.value
          if (type !== slot.type) {
            write(list => list.with(index, { type }))
          }
        }}
      />
    </>
  )
})

const Member = observer(function Member(props: {
  slotName: string
  slotSchema: IAnyType
  schema: AnyConfigurationModel
  slot?: AnyConfigurationModel | AnyConfigurationModel[]
  path?: string[]
  filter?: string
  expandedDisplayId?: string
  entry?: UnionEntry
}) {
  const { classes } = useStyles()
  const {
    slotName,
    slotSchema,
    schema,
    slot = schema[slotName],
    path = [],
    filter = '',
    expandedDisplayId,
    entry,
  } = props
  // when the sub-schema's own name matches, drop the filter for its children so
  // the whole group stays visible; otherwise keep filtering descendants
  const childFilter = slotName.toLowerCase().includes(filter.toLowerCase())
    ? ''
    : filter
  if (isConfigurationSchemaType(slotSchema)) {
    // an array-typed sub-schema (e.g. `displays`) renders one Member per entry;
    // a single sub-schema (not an array) falls through to the accordion below.
    // keyed on Array.isArray, not `.length` truthiness, so an empty array maps
    // to nothing instead of being mis-handled as a single schema
    if (Array.isArray(slot)) {
      return <EntryList {...props} entries={slot} />
    }
    // if this is an explicitly typed schema, make a type-selecting dropdown
    // that can be used to change its type
    const typeNameChoices = getTypeNamesFromExplicitlyTypedUnion(slotSchema)
    return (
      <Accordion
        // an active filter force-expands the group so a match inside an
        // otherwise-collapsed (inactive display) sub-schema is actually
        // visible, not just present in the collapsed DOM. The key flips the
        // accordion between filtered/unfiltered mounts so the new
        // defaultExpanded takes effect (Accordion reads it only on mount).
        key={filter ? 'filtered' : 'unfiltered'}
        defaultExpanded={
          filter ? true : displayDefaultExpanded(slot, expandedDisplayId)
        }
        className={classes.accordion}
      >
        <AccordionSummary
          expandIcon={<ExpandMoreIcon className={classes.icon} />}
        >
          <Typography>{[...path, slotName].join('➔')}</Typography>
        </AccordionSummary>
        <AccordionDetails className={classes.expansionPanelDetails}>
          {entry && slot ? (
            <EntryControls
              schema={schema}
              title={slotName}
              slot={slot}
              entry={entry}
            />
          ) : null}
          {typeNameChoices.length ? (
            <TypeSelector
              typeNameChoices={typeNameChoices}
              slotName={slotName}
              slot={slot}
              onChange={evt => {
                if (evt.target.value !== slot?.type) {
                  schema.setSubschema(slotName, {
                    type: evt.target.value,
                  })
                }
              }}
            />
          ) : null}
          {/* an optional sub-schema (e.g. textSearchAdapter) has no node to
          show until the dropdown above picks a type */}
          {slot ? (
            <div className={classes.noOverflow}>
              <Schema
                schema={slot}
                path={[...path, slotName]}
                filter={childFilter}
                expandedDisplayId={expandedDisplayId}
              />
            </div>
          ) : null}
        </AccordionDetails>
      </Accordion>
    )
  } else if (isConfigurationSlot(schema, slotName)) {
    return <SlotEditor key={slotName} slot={makeSlotFacade(schema, slotName)} />
  } else {
    return null
  }
})

// An array of sub-schemas, one accordion per entry. A list whose entries are a
// `ConfigurationSchemaUnion` also offers each entry's type and place, and a new
// entry of any member type; a pluggable union such as a track's `displays` is
// not one, since a display is added through the track.
const EntryList = observer(function EntryList(props: {
  slotName: string
  slotSchema: IAnyType
  schema: AnyConfigurationModel
  entries: AnyConfigurationModel[]
  path?: string[]
  filter?: string
  expandedDisplayId?: string
}) {
  const { classes } = useStyles()
  const { slotName, slotSchema, schema, entries } = props
  const singular = singularSlotName(slotName)
  const union = arraySlotUnion(slotSchema)
  const choices = union ? Object.keys(union.members) : []
  return (
    <>
      {entries.map((subslot, index) => {
        const title = `${singular} ${index + 1}`
        return (
          <Member
            // eslint-disable-next-line @eslint-react/no-array-index-key -- a config entry has no identity but its place
            key={index}
            {...props}
            slot={subslot}
            slotName={
              union || !subslot.type ? title : `${title} ${subslot.type}`
            }
            entry={
              union
                ? { listName: slotName, choices, index, count: entries.length }
                : undefined
            }
          />
        )
      })}
      {union ? (
        <TextField
          className={classes.filter}
          select
          size="small"
          label={`Add ${singular}`}
          value=""
          onChange={evt => {
            setConf(schema, slotName, [
              ...listSnapshot(schema, slotName),
              { type: evt.target.value },
            ])
          }}
          fullWidth
        >
          {choices.map(type => (
            <MenuItem key={type} value={type}>
              {type}
            </MenuItem>
          ))}
        </TextField>
      ) : null}
    </>
  )
})

const Schema = observer(function Schema({
  schema,
  path = [],
  filter = '',
  expandedDisplayId,
}: {
  schema: AnyConfigurationModel
  path?: string[]
  filter?: string
  expandedDisplayId?: string
}) {
  const { classes } = useStyles()
  const [showAdvanced, setShowAdvanced] = useState(false)
  const query = filter.toLowerCase()
  const properties = getMembers(schema).properties
  const visible = Object.entries(properties).filter(
    ([slotName, slotSchema]) =>
      !query || memberMatches(schema, slotName, slotSchema, query),
  )
  const normal = visible.filter(
    ([slotName]) => !isAdvancedSlot(schema, slotName),
  )
  const advanced = visible.filter(([slotName]) =>
    isAdvancedSlot(schema, slotName),
  )
  const renderMember = ([slotName, slotSchema]: [string, IAnyType]) => (
    <Member
      key={slotName}
      slotName={slotName}
      slotSchema={slotSchema}
      path={path}
      schema={schema}
      filter={filter}
      expandedDisplayId={expandedDisplayId}
    />
  )
  return (
    <>
      {normal.map(renderMember)}
      {/* an active filter reveals matching advanced slots inline so search can
          find them; otherwise they hide behind the toggle */}
      {advanced.length && !query ? (
        <Button
          className={classes.advancedToggle}
          size="small"
          startIcon={showAdvanced ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          onClick={() => {
            setShowAdvanced(!showAdvanced)
          }}
        >
          {showAdvanced ? 'Hide' : 'Show'} advanced settings ({advanced.length})
        </Button>
      ) : null}
      {showAdvanced || query ? advanced.map(renderMember) : null}
    </>
  )
})

const ConfigurationEditor = observer(function ConfigurationEditor({
  model,
}: {
  model: {
    target?: AnyConfigurationModel
    expandedDisplayId?: string
  }
}) {
  const { classes } = useStyles()
  const [filter, setFilter] = useState('')
  // key forces a re-render, otherwise the same field can end up being used for
  // different tracks since only the backing model changes for example see pr
  // #804
  const target = model.target
  if (!target) {
    return <Typography>No configuration target</Typography>
  }
  const key = readConfObject(target, 'trackId')
  const name = readConfObject(target, 'name')
  return (
    <Accordion key={key} defaultExpanded className={classes.accordion}>
      <AccordionSummary
        expandIcon={<ExpandMoreIcon className={classes.icon} />}
      >
        <Typography>
          <SanitizedHTML html={name ?? 'Configuration'} />
        </Typography>
      </AccordionSummary>
      <AccordionDetails
        className={classes.expansionPanelDetails}
        data-testid="configEditor"
      >
        <TextField
          className={classes.filter}
          label="Filter options"
          value={filter}
          onChange={evt => {
            setFilter(evt.target.value)
          }}
          size="small"
          fullWidth
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: filter ? (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    aria-label="clear filter"
                    onClick={() => {
                      setFilter('')
                    }}
                  >
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null,
            },
          }}
        />
        {filter && !schemaMatches(target, filter.toLowerCase()) ? (
          <Typography className={classes.noResults}>
            No options match “{filter}”
          </Typography>
        ) : (
          <Schema
            schema={target}
            filter={filter}
            expandedDisplayId={model.expandedDisplayId}
          />
        )}
      </AccordionDetails>
    </Accordion>
  )
})

export default ConfigurationEditor
