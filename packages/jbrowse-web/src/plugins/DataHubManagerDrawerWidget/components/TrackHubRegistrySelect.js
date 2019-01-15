import Card from '@material-ui/core/Card'
import CardContent from '@material-ui/core/CardContent'
import CardHeader from '@material-ui/core/CardHeader'
import Collapse from '@material-ui/core/Collapse'
import Fade from '@material-ui/core/Fade'
import FormControl from '@material-ui/core/FormControl'
import FormControlLabel from '@material-ui/core/FormControlLabel'
import FormHelperText from '@material-ui/core/FormHelperText'
import Icon from '@material-ui/core/Icon'
import IconButton from '@material-ui/core/IconButton'
import InputLabel from '@material-ui/core/InputLabel'
import LinearProgress from '@material-ui/core/LinearProgress'
import MenuItem from '@material-ui/core/MenuItem'
import Radio from '@material-ui/core/Radio'
import RadioGroup from '@material-ui/core/RadioGroup'
import Select from '@material-ui/core/Select'
import { withStyles } from '@material-ui/core/styles'
import Typography from '@material-ui/core/Typography'
import PropTypes from 'prop-types'
import React from 'react'

function QueryStatus(props) {
  const { status } = props
  return (
    <div>
      <LinearProgress variant="query" />
      <Typography>{status}</Typography>
    </div>
  )
}

QueryStatus.propTypes = {
  status: PropTypes.string.isRequired,
}

const sbStyles = theme => ({
  formControl: {
    minWidth: 192,
    marginLeft: theme.spacing.unit * 2,
    marginRight: theme.spacing.unit * 2,
  },
})

const SelectBox = withStyles(sbStyles)(props => {
  const {
    classes,
    selectList,
    selectedItem,
    handleSelect,
    label,
    helpText,
  } = props
  return (
    <FormControl className={classes.formControl}>
      <InputLabel>{label}</InputLabel>
      <Select value={selectedItem} onChange={handleSelect}>
        {selectList.map(item => {
          let value
          let description
          if (item.name) {
            value = item.name
            description = `${item.name} (${item.synonyms.join(' ')})`
          }
          return (
            <MenuItem key={description || item} value={value || item}>
              {description || item}
            </MenuItem>
          )
        })}
      </Select>
      <FormHelperText>{selectedItem ? '' : helpText}</FormHelperText>
    </FormControl>
  )
})

SelectBox.propTypes = {
  selectList: PropTypes.arrayOf(
    PropTypes.oneOfType([PropTypes.string, PropTypes.shape()]),
  ).isRequired,
  selectedItem: PropTypes.string.isRequired,
  handleSelect: PropTypes.func.isRequired,
  label: PropTypes.string.isRequired,
  helpText: PropTypes.string.isRequired,
}

const styles = theme => ({
  card: {
    width: 300,
    marginBottom: theme.spacing.unit,
  },
})

@withStyles(styles)
class TrackHubRegistrySelect extends React.Component {
  static propTypes = {
    classes: PropTypes.shape({
      card: PropTypes.string.isRequired,
    }).isRequired,
    enableNext: PropTypes.func.isRequired,
    disableNext: PropTypes.func.isRequired,
    setTrackDbUrl: PropTypes.func.isRequired,
    setHubName: PropTypes.func.isRequired,
    setAssemblyName: PropTypes.func.isRequired,
  }

  constructor(props) {
    super(props)
    this.state = {
      errorMessage: null,
      assemblies: null,
      hubs: new Map(),
      selectedSpecies: '',
      selectedAssembly: '',
      selectedHub: '',
      allHubsRetrieved: false,
      hubCardExpanded: {},
    }
    this.mounted = false
  }

  componentDidMount() {
    this.mounted = true
    this.getAssemblies()
  }

  componentWillUnmount() {
    this.mounted = false
  }

  async getAssemblies() {
    const pingResponse = await this.doGet(
      'https://www.trackhubregistry.org/api/info/ping',
    )
    if (!pingResponse) return
    if (pingResponse.ping !== 1) {
      this.wrappedSetState({ errorMessage: 'Registry is not available' })
      return
    }
    const assembliesResponse = await this.doGet(
      'https://www.trackhubregistry.org/api/info/assemblies',
    )
    if (assembliesResponse)
      this.wrappedSetState({ assemblies: assembliesResponse })
  }

  async getHubs(selectedAssembly, reset) {
    const { hubs } = this.state
    if (reset) hubs.clear()
    const page = Math.floor(hubs.size / 5) + 1
    const response = await this.doPost(
      'https://www.trackhubregistry.org/api/search',
      { assembly: selectedAssembly },
      { page, entries_per_page: 5 },
    )
    if (response) {
      response.items.forEach(item => {
        hubs.set(item.id, item)
      })
      const allHubsRetrieved = hubs.size === response.total_entries
      this.wrappedSetState({ hubs, allHubsRetrieved })
      if (!allHubsRetrieved) this.getHubs(selectedAssembly)
    }
  }

  async getTrackDbUrl(hub) {
    const fullHub = await this.doGet(
      `https://www.trackhubregistry.org/api/search/trackdb/${hub.id}`,
    )
    if (fullHub) return fullHub.source.url
    return null
  }

  handleSelectSpecies = event => {
    const { disableNext } = this.props
    this.wrappedSetState({
      selectedSpecies: event.target.value,
      selectedAssembly: '',
      selectedHub: '',
      hubCardExpanded: {},
    })
    disableNext()
  }

  handleSelectAssembly = event => {
    const { disableNext, setAssemblyName } = this.props
    this.wrappedSetState({
      selectedAssembly: event.target.value,
      selectedHub: '',
      hubCardExpanded: {},
    })
    disableNext()
    setAssemblyName(event.target.value)
    this.getHubs(event.target.value, true)
  }

  handleSelectHub = async event => {
    const { hubs } = this.state
    const { enableNext, setHubName, setTrackDbUrl } = this.props
    this.wrappedSetState({
      selectedHub: event.target.value,
      hubCardExpanded: {},
    })
    const selectedHubObj = hubs.get(event.target.value)
    setHubName(selectedHubObj.hub.shortLabel)
    const trackDbUrl = await this.getTrackDbUrl(selectedHubObj)
    if (!trackDbUrl) return
    setTrackDbUrl(new URL(trackDbUrl))
    enableNext()
  }

  handleHubCardExpand = hub => {
    const { hubCardExpanded } = this.state
    if (!hubCardExpanded[hub]) hubCardExpanded[hub] = true
    else hubCardExpanded[hub] = false
    this.wrappedSetState({ hubCardExpanded })
  }

  // Since there's a lot of async stuff going on, this keeps React from
  // complaning about the component trying to update state after unmounting
  wrappedSetState(...args) {
    if (this.mounted) this.setState(...args)
  }

  async doGet(url, params = {}) {
    let rawResponse
    const urlParams = Object.keys(params)
      .map(param => `${param}=${params[param]}`)
      .join(';')
    try {
      rawResponse = await fetch(`${url}${urlParams ? `?${urlParams}` : ''}`)
    } catch (error) {
      this.wrappedSetState({
        errorMessage: (
          <span>
            <strong>Network connection error.</strong> <br />
            {error.message} <br />
            {url}
          </span>
        ),
      })
      return null
    }
    if (!rawResponse.ok) {
      this.wrappedSetState({
        errorMessage: (
          <span>
            <strong>Error connecting to the URL.</strong> <br />
            {rawResponse.status}: {rawResponse.statusText} <br />
            {url}
          </span>
        ),
      })
      return null
    }
    return rawResponse.json()
  }

  async doPost(url, data = {}, params = {}) {
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
      this.wrappedSetState({
        errorMessage: (
          <span>
            <strong>Network connection error.</strong> <br />
            {error.message} <br />
            {url}
          </span>
        ),
      })
      return null
    }
    if (!rawResponse.ok) {
      this.wrappedSetState({
        errorMessage: (
          <span>
            <strong>Error connecting to the URL.</strong> <br />
            {rawResponse.status}: {rawResponse.statusText} <br />
            {url}
          </span>
        ),
      })
      return null
    }
    return rawResponse.json()
  }

  render() {
    const {
      assemblies,
      selectedSpecies,
      selectedAssembly,
      selectedHub,
      hubs,
      allHubsRetrieved,
      errorMessage,
      hubCardExpanded,
    } = this.state

    const { classes } = this.props

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
        handleSelect={this.handleSelectSpecies}
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
          handleSelect={this.handleSelectAssembly}
          label="Assembly"
          helpText="Select an assembly"
        />,
      )

    if (selectedAssembly) {
      renderItems.push(
        <div key="hubselect">
          <Typography>Hubs:</Typography>
          <RadioGroup value={selectedHub} onChange={this.handleSelectHub}>
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
                          <IconButton
                            onClick={() => this.handleHubCardExpand(hub.id)}
                          >
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
        renderItems.push(
          <QueryStatus key="hubstatus" status="Retrieving hubs" />,
        )
    }

    return <div>{renderItems}</div>
  }
}

export default TrackHubRegistrySelect
