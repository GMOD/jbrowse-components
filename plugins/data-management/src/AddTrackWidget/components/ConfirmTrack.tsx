import { readConfObject } from '@jbrowse/core/configuration'
import { getSession } from '@jbrowse/core/util'
import {
  Link,
  MenuItem,
  TextField,
  ListSubheader,
  Typography,
  makeStyles,
} from '@material-ui/core'
import { observer } from 'mobx-react'
import { getEnv } from 'mobx-state-tree'
import React from 'react'
import { UNKNOWN } from '@jbrowse/core/util/tracks'
import { AddTrackModel } from '../model'

const useStyles = makeStyles(theme => ({
  spacing: {
    marginBottom: theme.spacing(3),
  },
}))

function StatusMessage({
  trackAdapter,
  trackType,
}: {
  trackAdapter: { type: string; subadapter?: { type: string } }
  trackType: string
}) {
  const classes = useStyles()
  return trackAdapter.type === 'SNPCoverageAdapter' ? (
    <Typography className={classes.spacing}>
      Selected <code>{trackType}</code>. Using adapter{' '}
      <code>{trackAdapter.type}</code> with subadapter{' '}
      <code>{trackAdapter.subadapter?.type}</code>. Please enter a track name
      and, if necessary, update the track type.
    </Typography>
  ) : (
    <Typography className={classes.spacing}>
      Using adapter <code>{trackAdapter.type}</code> and guessing track type{' '}
      <code>{trackType}</code>. Please enter a track name and, if necessary,
      update the track type.
    </Typography>
  )
}

/**
 * categorizeAdapters takes a list of adapters and sorts their menu item elements under an appropriate ListSubheader
 *  element. In this way, adapters that are from external plugins can have headers that differentiate them from the
 *  out-of-the-box plugins.
 * @param adaptersList - a list of adapters found in the PluginManager
 * @returns a series of JSX elements that are ListSubheaders followed by the adapters
 *   found under that subheader
 */
function categorizeAdapters(
  adaptersList: { name: string; adapterCategoryHeader: string }[],
) {
  let currentPluginName = ''
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: any = []
  adaptersList.forEach(adapter => {
    if (adapter.adapterCategoryHeader) {
      if (currentPluginName !== adapter.adapterCategoryHeader) {
        currentPluginName = adapter.adapterCategoryHeader
        items.push(
          <ListSubheader
            key={adapter.adapterCategoryHeader}
            value={adapter.adapterCategoryHeader}
          >
            {adapter.adapterCategoryHeader}
          </ListSubheader>,
        )
      }
      items.push(
        <MenuItem key={adapter.name} value={adapter.name}>
          {adapter.name}
        </MenuItem>,
      )
    }
  })
  return items
}

const TrackAdapterSelector = observer(({ model }: { model: AddTrackModel }) => {
  const classes = useStyles()
  const session = getSession(model)
  const { trackAdapter } = model
  // prettier-ignore
  const adapters = getEnv(session).pluginManager.getElementTypesInGroup(
    'adapter',
  )
  return (
    <TextField
      className={classes.spacing}
      value={trackAdapter?.type}
      label="adapterType"
      helperText="An adapter type"
      select
      fullWidth
      onChange={event => model.setAdapterHint(event.target.value)}
      SelectProps={{
        // @ts-ignore
        SelectDisplayProps: { 'data-testid': 'adapterTypeSelect' },
      }}
    >
      {adapters
        // Excludes any adapter with the 'excludeFromTrackSelector' property, and anything with the 'adapterCategoryHeader' property
        .filter(
          (elt: {
            name: string
            excludeFromTrackSelector: boolean
            adapterCategoryHeader: string
          }) => !elt.excludeFromTrackSelector && !elt.adapterCategoryHeader,
        )
        .map((elt: { name: string }) => (
          <MenuItem key={elt.name} value={elt.name}>
            {elt.name}
          </MenuItem>
        ))}
      {/* adapters with the 'adapterCategoryHeader' property are categorized by the value of the property here */}
      {categorizeAdapters(adapters)}
    </TextField>
  )
})

function UnknownAdapterPrompt({ model }: { model: AddTrackModel }) {
  const classes = useStyles()
  return (
    <>
      <Typography className={classes.spacing}>
        JBrowse was not able to guess the adapter type for this data, but it may
        be in the list below. If not, you can{' '}
        <Link
          href="https://github.com/GMOD/jbrowse-components/releases"
          target="_blank"
          rel="noopener noreferrer"
        >
          check for new releases
        </Link>{' '}
        of JBrowse to see if they support this data type or{' '}
        <Link
          href="https://github.com/GMOD/jbrowse-components/issues/new"
          target="_blank"
          rel="noopener noreferrer"
        >
          file an issue
        </Link>{' '}
        and add a feature request for this data type.
      </Typography>
      <TrackAdapterSelector model={model} />
    </>
  )
}

const TrackTypeSelector = observer(({ model }: { model: AddTrackModel }) => {
  const classes = useStyles()
  const session = getSession(model)
  const { trackType } = model

  return (
    <TextField
      className={classes.spacing}
      value={trackType}
      label="trackType"
      helperText="A track type"
      select
      fullWidth
      onChange={event => {
        model.setTrackType(event.target.value)
      }}
      SelectProps={{
        // @ts-ignore
        SelectDisplayProps: { 'data-testid': 'trackTypeSelect' },
      }}
    >
      {getEnv(session)
        .pluginManager.getElementTypesInGroup('track')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map(({ name }: any) => (
          <MenuItem key={name} value={name}>
            {name}
          </MenuItem>
        ))}
    </TextField>
  )
})

const TrackAssemblySelector = observer(
  ({ model }: { model: AddTrackModel }) => {
    const session = getSession(model)
    const { assembly } = model
    return (
      <TextField
        value={assembly}
        label="assemblyName"
        helperText="Assembly to which the track will be added"
        select
        fullWidth
        onChange={event => model.setAssembly(event.target.value)}
        SelectProps={{
          // @ts-ignore
          SelectDisplayProps: { 'data-testid': 'assemblyNameSelect' },
        }}
      >
        {session.assemblies.map(conf => {
          const name = readConfObject(conf, 'name')
          return (
            <MenuItem key={name} value={name}>
              {name}
            </MenuItem>
          )
        })}
      </TextField>
    )
  },
)

function ConfirmTrack({ model }: { model: AddTrackModel }) {
  const classes = useStyles()
  const { trackName, trackAdapter, trackType, warningMessage, adapterHint } =
    model

  if (model.unsupported) {
    return (
      <Typography className={classes.spacing}>
        This version of JBrowse cannot display data of this type. It is
        possible, however, that there is a newer version that can display them.
        You can{' '}
        <Link
          href="https://github.com/GMOD/jbrowse-components/releases"
          target="_blank"
          rel="noopener noreferrer"
        >
          check for new releases
        </Link>{' '}
        of JBrowse or{' '}
        <Link
          href="https://github.com/GMOD/jbrowse-components/issues/new"
          target="_blank"
          rel="noopener noreferrer"
        >
          file an issue
        </Link>{' '}
        and add a feature request for this data type.
      </Typography>
    )
  }
  if (trackAdapter?.type === UNKNOWN) {
    return <UnknownAdapterPrompt model={model} />
  }

  if (adapterHint === '' && trackAdapter) {
    model.setAdapterHint(trackAdapter.type)
  }

  if (!trackAdapter?.type) {
    return <Typography>Could not recognize this data type.</Typography>
  }

  return (
    <div>
      {trackAdapter ? (
        <StatusMessage trackAdapter={trackAdapter} trackType={trackType} />
      ) : null}
      {warningMessage ? (
        <Typography style={{ color: 'orange' }}>{warningMessage}</Typography>
      ) : null}
      <TextField
        className={classes.spacing}
        label="trackName"
        helperText="A name for this track"
        fullWidth
        value={trackName}
        onChange={event => model.setTrackName(event.target.value)}
        inputProps={{ 'data-testid': 'trackNameInput' }}
      />
      <TrackAdapterSelector model={model} />
      <TrackTypeSelector model={model} />
      <TrackAssemblySelector model={model} />
    </div>
  )
}

export default observer(ConfirmTrack)
