import Card from '@material-ui/core/Card'
import CardContent from '@material-ui/core/CardContent'
import CardHeader from '@material-ui/core/CardHeader'
import Collapse from '@material-ui/core/Collapse'
import Fade from '@material-ui/core/Fade'
import FormControlLabel from '@material-ui/core/FormControlLabel'
import Icon from '@material-ui/core/Icon'
import IconButton from '@material-ui/core/IconButton'
import LinearProgress from '@material-ui/core/LinearProgress'
import Radio from '@material-ui/core/Radio'
import RadioGroup from '@material-ui/core/RadioGroup'
import { withStyles } from '@material-ui/core/styles'
import Typography from '@material-ui/core/Typography'
import PropTypes from 'prop-types'
import React, { useState, useEffect } from 'react'
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
  const [hubs, setHubs] = useState(new Map())
  const [selectedSpecies, setSelectedSpecies] = useState('')
  const [selectedAssembly, setSelectedAssembly] = useState('')
  const [selectedHub, setSelectedHub] = useState('')
  const [allHubsRetrieved, setAllHubsRetrieved] = useState(false)
  const [hubCardExpanded, setHubCardExpanded] = useState({})

  const {
    classes,
    enableNext,
    disableNext,
    setTrackDbUrl,
    setHubName,
    setAssemblyName,
  } = props

  useEffect(() => {
    if (errorMessage) return
    if (!assemblies) {
      getAssemblies()
      return
    }
    if (selectedAssembly && !hubs.size) {
      getHubs(true)
      return
    }
    if (hubs.size && !allHubsRetrieved) getHubs()
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
      response.items.forEach(item => {
        newHubs.set(item.id, item)
      })
      setHubs(newHubs)
      if (newHubs.size === response.total_entries) setAllHubsRetrieved(true)
    }
  }

  async function getTrackDbUrl(hub) {
    const fullHub = await doGet(
      `https://www.trackhubregistry.org/api/search/trackdb/${hub.id}`,
    )
    if (fullHub) return fullHub.source.url
    return null
  }

  function handleSelectSpecies(event) {
    setSelectedSpecies(event.target.value)
    setSelectedAssembly('')
    setSelectedHub('')
    setHubCardExpanded({})
    disableNext()
  }

  function handleSelectAssembly(event) {
    setSelectedAssembly(event.target.value)
    setSelectedHub('')
    setHubCardExpanded({})
    disableNext()
    setAssemblyName(event.target.value)
  }

  async function handleSelectHub(event) {
    setSelectedHub(event.target.value)
    setHubCardExpanded({})
    const selectedHubObj = hubs.get(event.target.value)
    setHubName(selectedHubObj.hub.shortLabel)
    const trackDbUrl = await getTrackDbUrl(selectedHubObj)
    if (!trackDbUrl) return
    setTrackDbUrl(new URL(trackDbUrl))
    enableNext()
  }

  function handleHubCardExpand(hub) {
    if (!hubCardExpanded[hub]) hubCardExpanded[hub] = true
    else hubCardExpanded[hub] = false
    setHubCardExpanded({ ...hubCardExpanded })
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
      <QueryStatus key="querystatus" status="Connecting to registry..." />,
    )
    return <div>{renderItems}</div>
  }

  const speciesList = Object.keys(assemblies).sort()

  renderItems.push(
    <SelectBox
      key="speciesselect"
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
        key="assemblyselect"
        selectList={assemblies[selectedSpecies]}
        selectedItem={selectedAssembly}
        handleSelect={handleSelectAssembly}
        label="Assembly"
        helpText="Select an assembly"
      />,
    )

  if (selectedAssembly) {
    renderItems.push(
      <div key="hubselect">
        <Typography>Hubs:</Typography>
        <RadioGroup value={selectedHub} onChange={handleSelectHub}>
          {Array.from(hubs.values()).map(hub => (
            <FormControlLabel
              key={hub.id}
              value={hub.id}
              label={
                <Fade in>
                  <Card
                    className={classes.card}
                    raised={hub.id === selectedHub}
                  >
                    <CardHeader
                      title={hub.hub.shortLabel}
                      titleTypographyProps={{ variant: 'body1' }}
                      action={
                        <IconButton onClick={() => handleHubCardExpand(hub.id)}>
                          <Icon>
                            {hub.id === selectedHub || hubCardExpanded[hub.id]
                              ? 'expand_less'
                              : 'expand_more'}
                          </Icon>
                        </IconButton>
                      }
                    />
                    <Collapse
                      in={hub.id === selectedHub || hubCardExpanded[hub.id]}
                      unmountOnExit
                    >
                      <CardContent>
                        <Typography paragraph>{hub.hub.longLabel}</Typography>
                      </CardContent>
                    </Collapse>
                  </Card>
                </Fade>
              }
              control={<Radio />}
            />
          ))}
        </RadioGroup>
      </div>,
    )
    if (!allHubsRetrieved)
      renderItems.push(<QueryStatus key="hubstatus" status="Retrieving hubs" />)
  }

  return <div>{renderItems}</div>
}

TrackHubRegistrySelect.propTypes = {
  classes: PropTypes.objectOf(PropTypes.string).isRequired,
  enableNext: PropTypes.func.isRequired,
  disableNext: PropTypes.func.isRequired,
  setTrackDbUrl: PropTypes.func.isRequired,
  setHubName: PropTypes.func.isRequired,
  setAssemblyName: PropTypes.func.isRequired,
}

export default withStyles(styles)(TrackHubRegistrySelect)
