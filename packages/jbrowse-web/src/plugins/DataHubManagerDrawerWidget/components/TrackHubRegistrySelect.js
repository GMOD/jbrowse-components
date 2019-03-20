import FormControlLabel from '@material-ui/core/FormControlLabel'
import LinearProgress from '@material-ui/core/LinearProgress'
import Radio from '@material-ui/core/Radio'
import RadioGroup from '@material-ui/core/RadioGroup'
import { withStyles } from '@material-ui/core/styles'
import Tooltip from '@material-ui/core/Tooltip'
import Typography from '@material-ui/core/Typography'
import PropTypes from 'prop-types'
import React, { useEffect, useState } from 'react'
import { fetchHubFile } from '../../../connections/ucscHub'
import GenomeSelector from './GenomeSelector'
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

const styles = theme => ({
  card: {
    width: 300,
    marginBottom: theme.spacing.unit,
  },
})

function TrackHubRegistrySelect(props) {
  const [errorMessage, setErrorMessage] = useState(null)
  const [assemblies, setAssemblies] = useState(null)
  const [selectedSpecies, setSelectedSpecies] = useState('')
  const [selectedAssembly, setSelectedAssembly] = useState('')
  const [hubs, setHubs] = useState(new Map())
  const [allHubsRetrieved, setAllHubsRetrieved] = useState(false)
  const [selectedHub, setSelectedHub] = useState('')
  const [hubTxt, setHubTxt] = useState(null)

  const {
    setHubName,
    hubUrl,
    setHubUrl,
    assemblyNames,
    setAssemblyNames,
  } = props

  useEffect(() => {
    getAssemblies()
  }, [])

  useEffect(() => {
    if (errorMessage) return
    if (selectedAssembly && !hubs.size) getHubs(true)
    else if (hubs.size && !allHubsRetrieved) getHubs()
  })

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

  async function getHubs(reset) {
    const newHubs = reset ? new Map() : new Map(hubs)
    const page = Math.floor(hubs.size / 5) + 1
    const response = await doPost(
      'https://www.trackhubregistry.org/api/search',
      { assembly: selectedAssembly },
      { page, entries_per_page: 5 },
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
    setHubTxt(null)
  }

  function handleSelectAssembly(event) {
    setSelectedAssembly(event.target.value)
    setHubs(new Map())
    setSelectedHub('')
    setAllHubsRetrieved(false)
    setHubTxt(null)
  }

  async function handleSelectHub(event) {
    setSelectedHub(event.target.value)
    const selectedHubObj = hubs.get(event.target.value)
    setHubName(selectedHubObj.hub.shortLabel)
    setHubUrl(selectedHubObj.hub.url)
    const hubFile = await fetchHubFile({ uri: selectedHubObj.hub.url })
    setHubTxt(hubFile)
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
        <Typography>Hubs:</Typography>
        <RadioGroup value={selectedHub} onChange={handleSelectHub}>
          {Array.from(hubs.values()).map(hub => {
            const disabled = Boolean(hub.error)
            return (
              <Tooltip
                key={hub.id}
                title={disabled ? hub.error : hub.hub.longLabel}
                placement="left"
              >
                <FormControlLabel
                  value={hub.id}
                  label={hub.hub.shortLabel}
                  disabled={disabled}
                  control={<Radio />}
                />
              </Tooltip>
            )
          })}
        </RadioGroup>
      </div>,
    )
    if (!allHubsRetrieved)
      renderItems.push(<QueryStatus key="hubStatus" status="Retrieving hubs" />)
  }

  if (hubTxt)
    renderItems.push(
      <GenomeSelector
        key="genomeSelect"
        hubUrl={hubUrl}
        hubTxt={hubTxt}
        assemblyNames={assemblyNames}
        setAssemblyNames={setAssemblyNames}
      />,
    )

  return <div>{renderItems}</div>
}

TrackHubRegistrySelect.propTypes = {
  setHubName: PropTypes.func.isRequired,
  hubUrl: PropTypes.string.isRequired,
  setHubUrl: PropTypes.func.isRequired,
  assemblyNames: PropTypes.arrayOf(PropTypes.string).isRequired,
  setAssemblyNames: PropTypes.func.isRequired,
}

export default withStyles(styles)(TrackHubRegistrySelect)
