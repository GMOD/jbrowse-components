import FormControl from '@material-ui/core/FormControl'
import FormControlLabel from '@material-ui/core/FormControlLabel'
import FormLabel from '@material-ui/core/FormLabel'
import LinearProgress from '@material-ui/core/LinearProgress'
import Radio from '@material-ui/core/Radio'
import RadioGroup from '@material-ui/core/RadioGroup'
import { makeStyles } from '@material-ui/core/styles'
import Tooltip from '@material-ui/core/Tooltip'
import Typography from '@material-ui/core/Typography'
import { PropTypes as MobxPropTypes } from 'mobx-react'
import PropTypes from 'prop-types'
import React, { useEffect, useState } from 'react'
import sanitizeHtml from 'sanitize-html'
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
    if (selectedHub) setModelReady(true)
    else setModelReady(false)
  }, [selectedHub, setModelReady])

  useEffect(() => {
    async function getAssemblies() {
      const pingResponse = await doGet(
        'https://www.trackhubregistry.org/api/info/ping',
      )
      if (!pingResponse) return
      if (pingResponse.ping !== 1) {
        setErrorMessage('Registry is not available')
        return
      }
      const assembliesResponse = await doGet(
        'https://www.trackhubregistry.org/api/info/assemblies',
      )
      if (assembliesResponse) setAssemblies(assembliesResponse)
    }

    getAssemblies()
  }, [])

  useEffect(() => {
    if (errorMessage) return
    if (selectedAssembly && !hubs.size) getHubs(true)
    else if (hubs.size && !allHubsRetrieved) getHubs()
  })

  async function getHubs(reset) {
    const entriesPerPage = 10
    const newHubs = reset ? new Map() : new Map(hubs)
    const page = Math.floor(hubs.size / entriesPerPage) + 1
    const response = await doPost(
      'https://www.trackhubregistry.org/api/search',
      { assembly: selectedAssembly },
      // eslint-disable-next-line @typescript-eslint/camelcase
      { page, entries_per_page: entriesPerPage },
    )
    if (response) {
      for (const item of response.items) {
        if (item.hub.url.startsWith('ftp'))
          item.error = 'JBrowse web cannot add connections from FTP sources'
        else {
          let rawResponse
          try {
            // eslint-disable-next-line no-await-in-loop
            rawResponse = await fetch(item.hub.url, { method: 'HEAD' })
          } catch (error) {
            item.error = error.message
          }
          if (rawResponse && !rawResponse.ok)
            item.error = `${response.status}: ${response.statusText}`
        }
        newHubs.set(item.id, item)
      }
      setHubs(newHubs)
      if (newHubs.size === response.total_entries) setAllHubsRetrieved(true)
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

  async function handleSelectHub(event) {
    const newHub = event.target.value
    setSelectedHub(newHub)
    model.target.name.set(hubs.get(newHub).hub.shortLabel)
    model.target.trackDbId.set(newHub)
  }

  async function doGet(url, params = {}) {
    let rawResponse
    const urlParams = Object.keys(params)
      .map(param => `${param}=${params[param]}`)
      .join(';')
    try {
      rawResponse = await fetch(`${url}${urlParams ? `?${urlParams}` : ''}`)
    } catch (error) {
      setErrorMessage(
        <span>
          <strong>Network connection error.</strong> <br />
          {error.message} <br />
          {url}
        </span>,
      )
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

  async function doPost(url, data = {}, params = {}) {
    let rawResponse
    const urlParams = Object.keys(params)
      .map(param => `${param}=${params[param]}`)
      .join(';')
    try {
      rawResponse = await fetch(`${url}${urlParams ? `?${urlParams}` : ''}`, {
        method: 'POST',
        body: JSON.stringify(data),
      })
    } catch (error) {
      setErrorMessage(
        <span>
          <strong>Network connection error.</strong> <br />
          {error.message} <br />
          {url}
        </span>,
      )
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

  const speciesList = Object.keys(assemblies).sort()

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

  if (selectedSpecies)
    renderItems.push(
      <SelectBox
        key="assemblySelect"
        selectList={assemblies[selectedSpecies]}
        selectedItem={selectedAssembly}
        handleSelect={handleSelectAssembly}
        label="Assembly"
        helpText="Select an assembly"
      />,
    )

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
                  const disabled = Boolean(hub.error)
                  const allowedHtml = {
                    allowedTags: ['b', 'i', 'em', 'strong', 'a', 'p'],
                    allowedAttributes: {
                      a: ['href'],
                    },
                  }
                  const cleanShortLabel = (
                    <div
                      // It's sanitized, so should be fine to use dangerouslySetInnerHTML
                      dangerouslySetInnerHTML={{
                        __html: sanitizeHtml(hub.hub.shortLabel, allowedHtml),
                      }}
                    />
                  )
                  const cleanLongLabel = (
                    <div
                      // It's sanitized, so should be fine to use dangerouslySetInnerHTML
                      dangerouslySetInnerHTML={{
                        __html: sanitizeHtml(hub.hub.longLabel, allowedHtml),
                      }}
                    />
                  )
                  return (
                    <Wire key={hub.id} value={hub.id}>
                      {formControlProps => (
                        <Tooltip
                          title={disabled ? hub.error : cleanLongLabel}
                          placement="left"
                          interactive
                        >
                          <FormControlLabel
                            key={hub.id}
                            value={hub.id}
                            label={cleanShortLabel}
                            disabled={disabled}
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
    if (!allHubsRetrieved)
      renderItems.push(<QueryStatus key="hubStatus" status="Retrieving hubs" />)
  }

  if (selectedHub)
    renderItems.push(
      <HubDetails key="hubDetails" hub={hubs.get(selectedHub).hub} />,
    )

  return <>{renderItems}</>
}

TrackHubRegistrySelect.propTypes = {
  model: MobxPropTypes.objectOrObservableObject.isRequired,
  setModelReady: PropTypes.func.isRequired,
}

export default TrackHubRegistrySelect
