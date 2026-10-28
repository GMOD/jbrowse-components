import { useState } from 'react'

import {
  getSlotDefinition,
  isConfigurationModel,
  isConfigurationSlot,
  makeSlotFacade,
  plotKeysOf,
  readConfObject,
} from '@jbrowse/core/configuration'
import SanitizedHTML from '@jbrowse/core/ui/SanitizedHTML'
import { getEnv } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { getMembers } from '@jbrowse/mobx-state-tree'
import DataObjectIcon from '@mui/icons-material/DataObject'
import { Button, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import SettingsJsonDialog from './SettingsJsonDialog.tsx'
import SlotEditor from './SlotEditor.tsx'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

const useStyles = makeStyles()(theme => ({
  root: {
    padding: theme.spacing(1),
  },
  heading: {
    marginBlock: theme.spacing(2, 1),
  },
  note: {
    marginBottom: theme.spacing(2),
  },
}))

// A schema's own slots, without its sub-schemas or the ones it flags
// `advanced`; the JSON editor holds everything else.
function formSlots(schema: AnyConfigurationModel, omit: string[] = []) {
  return Object.keys(getMembers(schema).properties).filter(
    name =>
      !omit.includes(name) &&
      isConfigurationSlot(schema, name) &&
      !getSlotDefinition(schema, name).advanced,
  )
}

// the same member of the base config, which a reset returns to
function inBase(base: AnyConfigurationModel | undefined, name: string) {
  const member: unknown = base?.[name]
  return isConfigurationModel(member) ? member : undefined
}

function subSchemas(schema: AnyConfigurationModel) {
  return Object.keys(getMembers(schema).properties).flatMap(name => {
    const member: unknown = schema[name]
    return isConfigurationModel(member) ? [[name, member] as const] : []
  })
}

const Slots = observer(function Slots({
  schema,
  base,
  omit,
}: {
  schema: AnyConfigurationModel
  base?: AnyConfigurationModel
  omit?: string[]
}) {
  return formSlots(schema, omit).map(name => (
    <SlotEditor key={name} slot={makeSlotFacade(schema, name, base)} />
  ))
})

const Section = observer(function Section({
  title,
  nested = false,
  children,
}: {
  title: string
  nested?: boolean
  children: React.ReactNode
}) {
  const { classes } = useStyles()
  return (
    <>
      <Typography
        variant={nested ? 'subtitle1' : 'h6'}
        className={classes.heading}
      >
        {title}
      </Typography>
      {children}
    </>
  )
})

// Where the data comes from: the config's own adapter, and the adapter of
// each sub-schema holding one (an assembly's `sequence` and `refNameAliases`).
function dataSources(
  target: AnyConfigurationModel,
  base: AnyConfigurationModel | undefined,
) {
  return [
    ['Data', target, base] as const,
    ...subSchemas(target).map(
      ([name, schema]) => [name, schema, inBase(base, name)] as const,
    ),
  ].flatMap(([title, schema, schemaBase]) => {
    const adapter: unknown = schema.adapter
    return isConfigurationModel(adapter)
      ? [{ title, adapter, base: inBase(schemaBase, 'adapter') }]
      : []
  })
}

// An adapter's slots and those of its sub-schemas (a BAM's `index`)
const DataSection = observer(function DataSection({
  title,
  adapter,
  base,
}: {
  title: string
  adapter: AnyConfigurationModel
  base?: AnyConfigurationModel
}) {
  return (
    <Section title={title}>
      <Slots schema={adapter} base={base} />
      {subSchemas(adapter)
        .filter(([, sub]) => formSlots(sub).length)
        .map(([name, sub]) => (
          <Section key={name} title={name} nested>
            <Slots schema={sub} base={inBase(base, name)} />
          </Section>
        ))}
    </Section>
  )
})

// The display drawn in the view the editor was opened from. Its plot settings
// are what "Edit plot..." edits, so the form leaves them to it.
const DisplaySection = observer(function DisplaySection({
  display,
  base,
}: {
  display: AnyConfigurationModel
  base?: AnyConfigurationModel
}) {
  const { classes } = useStyles()
  const plotKeys = plotKeysOf(display)
  const { pluginManager } = getEnv(display)
  const displayType = pluginManager.displayTypes.has(display.type)
    ? pluginManager.getDisplayType(display.type)
    : undefined
  return (
    <Section title={`Display: ${displayType?.displayName ?? display.type}`}>
      {plotKeys.length ? (
        <Typography
          variant="body2"
          color="text.secondary"
          className={classes.note}
        >
          What the display draws (color, grouping, filters) is under the track
          menu&apos;s Advanced → Edit plot...
        </Typography>
      ) : null}
      <Slots schema={display} base={base} omit={plotKeys} />
    </Section>
  )
})

function activeDisplay(
  target: AnyConfigurationModel | undefined,
  displayId: string | undefined,
) {
  const displays: unknown =
    displayId === undefined ? undefined : target?.displays
  return Array.isArray(displays)
    ? (displays as AnyConfigurationModel[]).find(
        display => readConfObject(display, 'displayId') === displayId,
      )
    : undefined
}

/**
 * A short form over the settings most edits touch: the config's own slots,
 * where its data comes from, and the displayed display's own slots. "Edit as
 * JSON..." holds the whole config, every nested and advanced setting included.
 * With a `base`, a slot's reset returns it to the base's value.
 */
const ConfigurationEditor = observer(function ConfigurationEditor({
  model,
}: {
  model: {
    target?: AnyConfigurationModel
    base?: AnyConfigurationModel
    expandedDisplayId?: string
  }
}) {
  const { classes } = useStyles()
  const [editingJson, setEditingJson] = useState(false)
  const { target, base } = model
  if (!target) {
    return <Typography>No configuration target</Typography>
  }
  const display = activeDisplay(target, model.expandedDisplayId)
  const name = readConfObject(target, 'name') as string | undefined
  return (
    <div
      // remounts the fields for another track, which reuses this widget
      key={readConfObject(target, 'trackId')}
      className={classes.root}
      data-testid="configEditor"
    >
      {name ? (
        <Typography variant="h5">
          <SanitizedHTML html={name} />
        </Typography>
      ) : null}
      <Section title="General">
        <Slots schema={target} base={base} />
      </Section>
      {dataSources(target, base).map(source => (
        <DataSection key={source.title} {...source} />
      ))}
      {display ? (
        <DisplaySection
          display={display}
          base={activeDisplay(base, model.expandedDisplayId)}
        />
      ) : null}
      <Button
        variant="outlined"
        startIcon={<DataObjectIcon />}
        onClick={() => {
          setEditingJson(true)
        }}
      >
        Edit as JSON...
      </Button>
      {editingJson ? (
        <SettingsJsonDialog
          target={target}
          handleClose={() => {
            setEditingJson(false)
          }}
        />
      ) : null}
    </div>
  )
})

export default ConfigurationEditor
