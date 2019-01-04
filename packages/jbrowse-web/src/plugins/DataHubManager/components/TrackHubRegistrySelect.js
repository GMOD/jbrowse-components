import FormControl from '@material-ui/core/FormControl'
import FormHelperText from '@material-ui/core/FormHelperText'
import InputLabel from '@material-ui/core/InputLabel'
import LinearProgress from '@material-ui/core/LinearProgress'
import MenuItem from '@material-ui/core/MenuItem'
import Select from '@material-ui/core/Select'
import { withStyles } from '@material-ui/core/styles'
import Typography from '@material-ui/core/Typography'
import PropTypes from 'prop-types'
import React from 'react'

const styles = theme => ({
  formControl: {
    minWidth: 192,
    marginLeft: theme.spacing.unit * 2,
    marginRight: theme.spacing.unit * 2,
  },
})

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

const SelectBox = withStyles(styles)(props => {
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

class TrackHubRegistrySelect extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      errorMessage: null,
      assemblies: null,
      hubs: [],
      selectedSpecies: '',
      selectedAssembly: '',
      allHubsRetrieved: false,
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
    if (reset) hubs.length = 0
    const page = Math.floor(hubs.length / 5) + 1
    const response = await this.doPost(
      'https://www.trackhubregistry.org/api/search',
      { assembly: selectedAssembly },
      { page, entries_per_page: 5 },
    )
    if (response) {
      hubs.push(...response.items)
      const allHubsRetrieved = hubs.length === response.total_entries
      this.wrappedSetState({ hubs, allHubsRetrieved })
      if (!allHubsRetrieved) this.getHubs(selectedAssembly)
    }
  }

  handleSelectSpecies = event => {
    this.wrappedSetState({
      selectedSpecies: event.target.value,
      selectedAssembly: '',
    })
  }

  handleSelectAssembly = event => {
    this.wrappedSetState({ selectedAssembly: event.target.value })
    this.getHubs(event.target.value, true)
  }

  // Since there's a lot of async stuff going on, this keeps React from
  // complaning about the component trying to update state after unmounting
  wrappedSetState(...args) {
    if (this.mounted) this.setState(...args)
  }

  async doGet(url) {
    let rawResponse
    try {
      rawResponse = await fetch(url)
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

  async doPost(url, data, params) {
    let rawResponse
    const urlParams = Object.keys(params)
      .map(param => `${param}=${params[param]}`)
      .join(';')
    try {
      rawResponse = await fetch(`${url}?${urlParams}`, {
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
      hubs,
      allHubsRetrieved,
      errorMessage,
    } = this.state

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

    if (selectedSpecies) {
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
    }

    if (selectedAssembly) {
      renderItems.push(
        <div key="hubselect">
          <Typography>Hubs:</Typography>
          <ul>
            {hubs.map(hub => (
              <li key={hub.id}>{hub.hub.name}</li>
            ))}
          </ul>
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
