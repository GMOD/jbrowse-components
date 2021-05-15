/* eslint-disable react/prop-types */
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
  makeStyles,
} from '@material-ui/core'
import { isAbortException } from '@jbrowse/core/util'
import SanitizedHTML from '@jbrowse/core/ui/SanitizedHTML'
import PropTypes from 'prop-types'
import HubDetails from './HubDetails'
import SelectBox from './SelectBox'

function QueryStatus(props) {
  const { status } = props
  return (
    <>
      <LinearProgress variant="query" />
      <Typography>{status}</Typography>
    </>
  )
}

QueryStatus.propTypes = {
  status: PropTypes.string.isRequired,
}

// Need this for FormControlLabel to work with Tooltip
// https://github.com/mui-org/material-ui/issues/2225#issuecomment-460041878
function Wire({ children, ...props }) {
  return children(props)
}

const useStyles = makeStyles(theme => ({
  hubList: {
    maxHeight: 400,
    overflowY: 'auto',
  },
  genomeSelector: {
    marginTop: theme.spacing(1),
  },
}))

function TrackHubRegistrySelect({ model, setModelReady }) {
  const [errorMessage, setErrorMessage] = useState(null)
  const [assemblies, setAssemblies] = useState(null)
  const [selectedSpecies, setSelectedSpecies] = useState('')
  const [selectedAssembly, setSelectedAssembly] = useState('')
  const [hubs, setHubs] = useState(new Map())
  const [allHubsRetrieved, setAllHubsRetrieved] = useState(false)
  const [selectedHub, setSelectedHub] = useState('')
  const classes = useStyles()

  useEffect(() => {
    if (selectedHub) {
      setModelReady(true)
    } else {
      setModelReady(false)
    }
  }, [selectedHub, setModelReady])

  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller
    async function getAssemblies() {
      const pingResponse = await doGet(
        'https://www.trackhubregistry.org/api/info/ping',
        undefined,
        { signal },
      )
      if (!pingResponse) {
        return
      }
      if (pingResponse.ping !== 1) {
        setErrorMessage('Registry is not available')
        return
      }
      const assembliesResponse = await doGet(
        'https://www.trackhubregistry.org/api/info/assemblies',
        undefined,
        { signal },
      )
      if (assembliesResponse) {
        setAssemblies(assembliesResponse)
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
    if (!errorMessage) {
      if (selectedAssembly && !hubs.size) {
        getHubs(signal, true)
      } else if (hubs.size && !allHubsRetrieved) {
        getHubs(signal)
      }
    }

    return () => {
      controller.abort()
    }
  })

  async function getHubs(signal, reset) {
    const entriesPerPage = 10
    const newHubs = reset ? new Map() : new Map(hubs)
    const page = Math.floor(hubs.size / entriesPerPage) + 1
    const response = await doPost(
      'https://www.trackhubregistry.org/api/search',
      { page, entries_per_page: entriesPerPage },
      { body: JSON.stringify({ assembly: selectedAssembly }), signal },
    )
    if (response) {
      for (const item of response.items) {
        if (item.hub.url.startsWith('ftp://')) {
          item.error = 'JBrowse cannot add connections from FTP sources'
        } else {
          const hub = openLocation({ uri: item.hub.url })
          try {
            await hub.stat()
          } catch (error) {
            item.error = error.message
          }
        }
        newHubs.set(item.id, item)
      }
      setHubs(newHubs)
      if (newHubs.size === response.total_entries) {
        setAllHubsRetrieved(true)
      }
    }
  }

  function handleSelectSpecies(event) {
    setSelectedSpecies(event.target.value)
    setSelectedAssembly('')
    setHubs(new Map())
    setSelectedHub('')
    setAllHubsRetrieved(false)
  }

  function handleSelectAssembly(event) {
    setSelectedAssembly(event.target.value)
    setHubs(new Map())
    setSelectedHub('')
    setAllHubsRetrieved(false)
  }

  function handleSelectHub(event) {
    const newHub = event.target.value
    setSelectedHub(newHub)
    model.target.name.set(hubs.get(newHub).hub.shortLabel)
    model.target.assemblyNames.set([selectedAssembly])
    model.target.trackDbId.set(newHub)
  }

  async function doGet(url, params = {}, options = {}) {
    let rawResponse
    const urlParams = Object.keys(params)
      .map(param => `${param}=${params[param]}`)
      .join(';')
    try {
      rawResponse = await fetch(
        `${url}${urlParams ? `?${urlParams}` : ''}`,
        options,
      )
    } catch (error) {
      if (!isAbortException(error)) {
        setErrorMessage(
          <span>
            <strong>Network connection error.</strong> <br />
            {error.message} <br />
            {url}
          </span>,
        )
      }
      return null
    }
    if (!rawResponse.ok) {
      setErrorMessage(
        <span>
          <strong>Error connecting to the URL.</strong> <br />
          {rawResponse.status}: {rawResponse.statusText} <br />
          {url}
        </span>,
      )
      return null
    }
    return rawResponse.json()
  }

  async function doPost(url, params = {}, options = {}) {
    let rawResponse
    const urlParams = Object.keys(params)
      .map(param => `${param}=${params[param]}`)
      .join(';')
    try {
      rawResponse = await fetch(`${url}${urlParams ? `?${urlParams}` : ''}`, {
        ...options,
        method: 'POST',
      })
    } catch (error) {
      if (!isAbortException(error)) {
        setErrorMessage(
          <span>
            <strong>Network connection error.</strong> <br />
            {error.message} <br />
            {url}
          </span>,
        )
      }
      return null
    }
    if (!rawResponse.ok) {
      setErrorMessage(
        <span>
          <strong>Error connecting to the URL.</strong> <br />
          {rawResponse.status}: {rawResponse.statusText} <br />
          {url}
        </span>,
      )
      return null
    }
    return rawResponse.json()
  }

  const renderItems = [
    <Typography key="heading" variant="h6">
      The Track Hub Registry
    </Typography>,
  ]

  if (errorMessage) {
    renderItems.push(
      <Typography key="errorMessage" color="error">
        {errorMessage}
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

  const speciesList = Object.keys(assemblies)
    .sort()
    .filter(item => item.toLowerCase().includes('sapiens'))

  renderItems.push(
    <SelectBox
      key="speciesSelect"
      selectList={speciesList}
      selectedItem={selectedSpecies}
      handleSelect={handleSelectSpecies}
      label="Species"
      helpText="Select a species"
    />,
  )

  if (selectedSpecies) {
    const ret = assemblies[selectedSpecies].filter(
      s => !(s.name === 'GRCh37' && s.synonyms[0] === 'hg38'),
    )
    renderItems.push(
      <SelectBox
        key="assemblySelect"
        selectList={ret}
        selectedItem={selectedAssembly}
        handleSelect={handleSelectAssembly}
        label="Assembly"
        helpText="Select an assembly"
      />,
    )
  }

  if (selectedAssembly) {
    renderItems.push(
      <div key="hubSelect">
        <FormControl>
          <FormLabel>Hubs:</FormLabel>
          <div className={classes.hubList}>
            <RadioGroup value={selectedHub} onChange={handleSelectHub}>
              {Array.from(hubs.values())
                .filter(
                  hub =>
                    hub.assembly.name === selectedAssembly ||
                    hub.assembly.synonyms.includes(selectedAssembly),
                )
                .map(hub => {
                  const {
                    error,
                    id,
                    hub: { shortLabel, longLabel },
                  } = hub
                  return (
                    <Wire key={id} value={id}>
                      {formControlProps => (
                        <Tooltip
                          title={error || <SanitizedHTML html={longLabel} />}
                          placement="left"
                          interactive
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
