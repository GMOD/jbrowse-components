import React, { useEffect, useState } from 'react'
import {
  Card,
  CardContent,
  Checkbox,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  InputAdornment,
  ListSubheader,
  Link,
  List,
  ListItem,
  MenuItem,
  Paper,
  TextField,
  Typography,
} from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { readConfObject } from '@jbrowse/core/configuration'
import {
  supportedIndexingAdapters,
  getSession,
  getEnv,
  isElectron,
} from '@jbrowse/core/util'
import PluginManager from '@jbrowse/core/PluginManager'
import { observer } from 'mobx-react'
import { UNKNOWN } from '@jbrowse/core/util/tracks'
import { AdapterMetadata } from '@jbrowse/core/pluggableElementTypes/AdapterType'

// icons
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material//Add'
// locals
import { AddTrackModel } from '../model'

const useStyles = makeStyles()(theme => ({
  spacing: {
    marginBottom: theme.spacing(3),
  },
  paper: {
    display: 'flex',
    flexDirection: 'column',
    padding: theme.spacing(1),
  },
  spacer: {
    height: theme.spacing(8),
  },
  card: {
    marginTop: theme.spacing(1),
  },
}))

function StatusMessage({
  trackAdapter,
  trackType,
}: {
  trackAdapter: { type: string; subadapter?: { type: string } }
  trackType: string
}) {
  const { classes } = useStyles()
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
  adaptersList: { name: string; adapterMetadata: AdapterMetadata }[],
) {
  let currentCategory = ''
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: any = []
  adaptersList.forEach(adapter => {
    if (adapter.adapterMetadata?.category) {
      if (currentCategory !== adapter.adapterMetadata?.category) {
        currentCategory = adapter.adapterMetadata?.category
        items.push(
          <ListSubheader
            key={adapter.adapterMetadata?.category}
            value={adapter.adapterMetadata?.category}
          >
            {adapter.adapterMetadata?.category}
          </ListSubheader>,
        )
      }
      items.push(
        <MenuItem key={adapter.name} value={adapter.name}>
          {adapter.adapterMetadata?.displayName
            ? adapter.adapterMetadata?.displayName
            : adapter.name}
        </MenuItem>,
      )
    }
  })
  return items
}

function getAdapterTypes(pluginManager: PluginManager) {
  return pluginManager.getElementTypesInGroup('adapter') as {
    name: string
    adapterMetadata: AdapterMetadata
  }[]
}

function getTrackTypes(pluginManager: PluginManager) {
  return pluginManager.getElementTypesInGroup('track') as { name: string }[]
}

const TextIndexingConfig = observer(({ model }: { model: AddTrackModel }) => {
  const { classes } = useStyles()
  const [value1, setValue1] = useState('')
  const [value2, setValue2] = useState('')
  const [attributes, setAttributes] = useState(['Name', 'ID'])
  const [exclude, setExclude] = useState(['CDS', 'exon'])
  const sections = [
    {
      label: 'Indexing attributes',
      values: attributes,
    },
    {
      label: 'Feature types to exclude',
      values: exclude,
    },
  ]
  useEffect(() => {
    model.setTextIndexingConf({ attributes, exclude })
  }, [model, attributes, exclude])

  return (
    <Paper className={classes.paper}>
      <InputLabel>Indexing configuration</InputLabel>
      {sections.map((section, index) => (
        <Card raised key={section.label} className={classes.card}>
          <CardContent>
            <InputLabel>{section.label}</InputLabel>
            <List disablePadding>
              {section.values.map((val: string, idx: number) => (
                <ListItem key={idx} disableGutters>
                  <TextField
                    value={val}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            color="secondary"
                            onClick={() => {
                              const newAttr = section.values.filter((a, i) => {
                                return i !== idx
                              })
                              index === 0
                                ? setAttributes(newAttr)
                                : setExclude(newAttr)
                            }}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                </ListItem>
              ))}
              <ListItem disableGutters>
                <TextField
                  value={index === 0 ? value1 : value2}
                  placeholder="add new"
                  onChange={event => {
                    index === 0
                      ? setValue1(event.target.value)
                      : setValue2(event.target.value)
                  }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => {
                            if (index === 0) {
                              const newAttr: string[] = attributes
                              newAttr.push(value1)
                              setAttributes(newAttr)
                              setValue1('')
                            } else {
                              const newFeat: string[] = exclude
                              newFeat.push(value2)
                              setExclude(newFeat)
                              setValue2('')
                            }
                          }}
                          disabled={index === 0 ? value1 === '' : value2 === ''}
                          color="secondary"
                          data-testid={`stringArrayAdd-Feat`}
                        >
                          <AddIcon />
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </ListItem>
            </List>
          </CardContent>
        </Card>
      ))}
    </Paper>
  )
})

const TrackAdapterSelector = observer(({ model }: { model: AddTrackModel }) => {
  const { classes } = useStyles()
  const { trackAdapter } = model
  const { pluginManager } = getEnv(model)
  const adapters = getAdapterTypes(pluginManager)
  return (
    <TextField
      className={classes.spacing}
      value={trackAdapter?.type !== 'UNKNOWN' ? trackAdapter?.type : ''}
      label="adapterType"
      helperText="Select an adapter type"
      select
      fullWidth
      onChange={event => model.setAdapterHint(event.target.value)}
      SelectProps={{
        // @ts-ignore
        SelectDisplayProps: { 'data-testid': 'adapterTypeSelect' },
      }}
    >
      {adapters
        // Excludes any adapter with the 'adapterMetadata.hiddenFromGUI' property, and anything with the 'adapterMetadata.category' property
        .filter(
          elt =>
            !elt.adapterMetadata?.hiddenFromGUI &&
            !elt.adapterMetadata?.category,
        )
        .map(elt => (
          <MenuItem key={elt.name} value={elt.name}>
            {elt.adapterMetadata?.displayName
              ? elt.adapterMetadata?.displayName
              : elt.name}
          </MenuItem>
        ))}
      {
        // adapters with the 'adapterMetadata.category' property are categorized
        // by the value of the property here
        categorizeAdapters(
          adapters.filter(elt => !elt.adapterMetadata?.hiddenFromGUI),
        )
      }
    </TextField>
  )
})

function UnknownAdapterPrompt({ model }: { model: AddTrackModel }) {
  const { classes } = useStyles()
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
  const { classes } = useStyles()
  const session = getSession(model)
  const { trackType } = model
  const trackTypes = getTrackTypes(getEnv(session).pluginManager)

  return (
    <TextField
      className={classes.spacing}
      value={trackType}
      label="trackType"
      helperText="Select a track type"
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
      {trackTypes.map(({ name }) => (
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
        {session.assemblies
          .map(conf => readConfObject(conf, 'name'))
          .map(name => (
            <MenuItem key={name} value={name}>
              {name}
            </MenuItem>
          ))}
      </TextField>
    )
  },
)

function ConfirmTrack({ model }: { model: AddTrackModel }) {
  const { classes } = useStyles()
  const [check, setCheck] = useState(true)
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

  const supportedForIndexing = supportedIndexingAdapters(trackAdapter?.type)
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
      {isElectron && supportedForIndexing && (
        <FormControl>
          <FormControlLabel
            label={'Index track for text searching?'}
            control={
              <Checkbox
                checked={check}
                onChange={e => {
                  setCheck(e.target.checked)
                  model.setTextIndexTrack(e.target.checked)
                }}
              />
            }
          />
        </FormControl>
      )}
      {isElectron && check && supportedForIndexing ? (
        <TextIndexingConfig model={model} />
      ) : null}
    </div>
  )
}

export default observer(ConfirmTrack)
