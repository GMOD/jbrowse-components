import React, { useEffect, useState } from 'react'
import { openLocation } from '@jbrowse/core/util/io'
import {
  FormControl,
  FormControlLabel,
  FormLabel,
  LinearProgress,
  Radio,
  RadioGroup,
  Tooltip,
  Typography,
} from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { AbstractSessionModel, isAbortException } from '@jbrowse/core/util'
import { AnyConfigurationModel } from '@jbrowse/core/configuration'
import { AssemblySelector, SanitizedHTML } from '@jbrowse/core/ui'

// locals
import HubDetails from './HubDetails'
import SelectBox from './SelectBox'
import { mfetch, post_with_params } from './util'

function QueryStatus({ status }: { status: string }) {
  return (
    <>
      <LinearProgress variant="query" />
      <Typography>{status}</Typography>
    </>
  )
}

// Need this for FormControlLabel to work with Tooltip
// https://github.com/mui-org/material-ui/issues/2225#issuecomment-460041878
function Wire({
  children,
  ...props
}: {
  children: React.FC
  [key: string]: unknown
}) {
  return children(props)
}

const useStyles = makeStyles()(theme => ({
  hubList: {
    maxHeight: 400,
    overflowY: 'auto',
  },
  genomeSelector: {
    marginTop: theme.spacing(1),
  },
}))

interface HubAssembly {
  name: string
  synonyms: string[]
}

function TrackHubRegistrySelect({
  model: trackHubConfig,
  session,
}: {
  model: AnyConfigurationModel
  session: AbstractSessionModel
}) {
  const [error, setError] = useState<unknown>()
  const [assemblies, setAssemblies] = useState<Record<string, HubAssembly[]>>()
  const [selectedSpecies, setSelectedSpecies] = useState('')
  const [selectedTrackhubAssembly, setSelectedTrackhubAssembly] = useState('')
  const [hubs, setHubs] = useState(new Map())
  const [allHubsRetrieved, setAllHubsRetrieved] = useState(false)
  const [selectedHub, setSelectedHub] = useState('')
  const [selectedLocalAssembly, setSelectedLocalAssembly] = useState<string>()
  const { classes } = useStyles()

  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller
    async function getAssemblies() {
      try {
        const pingResponse = await mfetch(
          'https://www.trackhubregistry.org/api/info/ping',
          { signal },
        )
        if (pingResponse.ping !== 1) {
          setError('Registry is not available')
          return
        }
        const assembliesResponse = await mfetch(
          'https://www.trackhubregistry.org/api/info/assemblies',
          { signal },
        )
        setAssemblies(assembliesResponse)
      } catch (e) {
        if (!isAbortException(e)) {
          console.error(e)
          setError(e)
        }
      }
    }

    getAssemblies()

    return () => {
      controller.abort()
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller
    async function getHubs(reset?: boolean) {
      try {
        const entriesPerPage = 10
        const newHubs = reset ? new Map() : new Map(hubs)
        const page = Math.floor(hubs.size / entriesPerPage) + 1
        const response = await post_with_params(
          'https://www.trackhubregistry.org/api/search',
          { page, entries_per_page: entriesPerPage },
          {
            body: JSON.stringify({ assembly: selectedTrackhubAssembly }),
            signal,
          },
        )
        if (response) {
          for (const item of response.items) {
            if (item.hub.url.startsWith('ftp://')) {
              item.error = 'JBrowse cannot add connections from FTP sources'
            } else {
              const hub = openLocation({
                uri: item.hub.url,
                locationType: 'UriLocation',
              })
              try {
                await hub.stat()
              } catch (error) {
                item.error = `${error}`
              }
            }
            newHubs.set(item.id, item)
          }
          setHubs(newHubs)
          if (newHubs.size === response.total_entries) {
            setAllHubsRetrieved(true)
          }
        }
      } catch (e) {
        if (!isAbortException(e)) {
          console.error(e)
          setError(e)
        }
      }
    }

    ;(async () => {
      if (!error) {
        if (selectedTrackhubAssembly && !hubs.size) {
          getHubs(true)
        } else if (hubs.size && !allHubsRetrieved) {
          getHubs()
        }
      }
    })()

    return () => {
      controller.abort()
    }
  }, [selectedTrackhubAssembly, error, hubs, allHubsRetrieved])

  const renderItems = [
    <Typography key="heading" variant="h6">
      The Track Hub Registry
    </Typography>,
  ]

  if (error) {
    renderItems.push(
      <Typography key="error" color="error">
        {`${error}`}
      </Typography>,
    )
    return <div>{renderItems}</div>
  }

  if (!assemblies) {
    renderItems.push(
      <QueryStatus key="queryStatus" status="Connecting to registry..." />,
    )
    return <div>{renderItems}</div>
  }

  const speciesList = Object.keys(assemblies).sort()

  renderItems.push(
    <SelectBox
      key="speciesSelect"
      selectList={speciesList}
      selectedItem={selectedSpecies}
      handleSelect={event => {
        setSelectedSpecies(event.target.value)
        setSelectedTrackhubAssembly('')
        setHubs(new Map())
        setSelectedHub('')
        setAllHubsRetrieved(false)
      }}
      label="Species"
      helpText="Select a species"
    />,
  )

  if (selectedSpecies) {
    // trackhubregistry has this nonsense hg19 with alias hg38 entry, filter it out
    const ret = assemblies[selectedSpecies].filter(
      s => !(s.name === 'GRCh37' && s.synonyms[0] === 'hg38'),
    )
    renderItems.push(
      <SelectBox
        key="assemblySelect"
        selectList={ret}
        selectedItem={selectedTrackhubAssembly}
        handleSelect={event => {
          setSelectedTrackhubAssembly(event.target.value)
          setHubs(new Map())
          setSelectedHub('')
          setAllHubsRetrieved(false)
        }}
        label="Assembly"
        helpText="Select an assembly"
      />,
    )
  }

  if (selectedTrackhubAssembly) {
    renderItems.push(
      <div key="hubSelect">
        <Typography>
          Select an assembly from our local tracklist if it doesn't match the
          assembly name on the remote trackhub
        </Typography>
        <AssemblySelector
          session={session}
          onChange={val => setSelectedLocalAssembly(val)}
          selected={selectedLocalAssembly || selectedTrackhubAssembly}
        />
        <br />
        <FormControl>
          <FormLabel>Hubs:</FormLabel>
          <div className={classes.hubList}>
            <RadioGroup
              value={selectedHub}
              onChange={event => {
                const newHub = event.target.value
                setSelectedHub(newHub)

                // set values on a trackhub registry configSchema
                trackHubConfig.target.name.set(hubs.get(newHub).hub.shortLabel)
                trackHubConfig.target.assemblyNames.set([
                  selectedTrackhubAssembly,
                ])
                trackHubConfig.target.trackDbId.set(newHub)
              }}
            >
              {Array.from(hubs.values())
                .filter(
                  ({ assembly }) =>
                    assembly.name === selectedTrackhubAssembly ||
                    assembly.synonyms.includes(selectedTrackhubAssembly),
                )
                .map(h => {
                  const { error, id, hub } = h
                  const { shortLabel, longLabel } = hub
                  return (
                    <Wire key={id} value={id}>
                      {formControlProps => (
                        <Tooltip
                          title={error || <SanitizedHTML html={longLabel} />}
                          placement="left"
                        >
                          <FormControlLabel
                            key={id}
                            value={id}
                            label={<SanitizedHTML html={shortLabel} />}
                            disabled={Boolean(error)}
                            control={<Radio />}
                            {...formControlProps}
                          />
                        </Tooltip>
                      )}
                    </Wire>
                  )
                })}
            </RadioGroup>
          </div>
        </FormControl>
      </div>,
    )
    if (!allHubsRetrieved) {
      renderItems.push(<QueryStatus key="hubStatus" status="Retrieving hubs" />)
    }
  }

  if (selectedHub) {
    renderItems.push(
      <HubDetails key="hubDetails" hub={hubs.get(selectedHub).hub} />,
    )
  }

  return <>{renderItems}</>
}

export default TrackHubRegistrySelect
