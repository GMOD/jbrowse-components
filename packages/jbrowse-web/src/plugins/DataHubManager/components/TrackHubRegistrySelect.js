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

const styles = {
  formControl: {
    minWidth: 120,
  },
}

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
      networkStatus: null,
      registryStatus: null,
      assemblies: null,
      hubs: [],
      selectedSpecies: '',
      selectedAssembly: '',
      allHubsRetrieved: false,
    }
    this.getRegistryStatus()
  }

  async getRegistryStatus() {
    const response = await this.doGet(
      'https://www.trackhubregistry.org/api/info/ping',
    )
    if (!response || response.ping !== 1) {
      this.setState({ registryStatus: 'fail' })
      return
    }
    this.setState({ registryStatus: 'pass' })
    this.getAssemblies()
  }

  async getAssemblies() {
    const response = await this.doGet(
      'https://www.trackhubregistry.org/api/info/assemblies',
    )
    if (response) this.setState({ assemblies: response })
  }

  async getHubs(reset) {
    const { hubs, selectedAssembly } = this.state
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
      this.setState({ hubs, allHubsRetrieved })
      if (!allHubsRetrieved) this.getHubs()
    }
  }

  handleSelect = item => event => this.setState({ [item]: event.target.value })

  async doGet(url) {
    let rawResponse
    try {
      rawResponse = await fetch(url)
    } catch {
      this.setState({ networkStatus: 'fail' })
      return null
    }
    if (!rawResponse.ok) {
      this.setState({ registryStatus: 'fail' })
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
    } catch {
      this.setState({ networkStatus: 'fail' })
      return null
    }
    if (!rawResponse.ok) {
      this.setState({ registryStatus: 'fail' })
      return null
    }
    return rawResponse.json()
  }

  render() {
    const {
      networkStatus,
      registryStatus,
      assemblies,
      selectedSpecies,
      selectedAssembly,
      hubs,
      allHubsRetrieved,
    } = this.state

    const renderItems = [
      <Typography key="heading" variant="h6">
        The Track Hub Registry
      </Typography>,
    ]

    if (networkStatus === 'fail') {
      renderItems.push(
        <Typography key="networkerror" color="error">
          Network connection error
        </Typography>,
      )
      return <div>{renderItems}</div>
    }

    if (registryStatus === 'fail') {
      renderItems.push(
        <Typography key="registryerror" color="error">
          Error connecting to the registry
        </Typography>,
      )
      return <div>{renderItems}</div>
    }

    if (!assemblies) {
      let status
      if (!networkStatus) status = 'Connecting to network...'
      else if (!registryStatus) status = 'Connecting to registry...'
      else if (networkStatus === 'pass' && registryStatus === 'pass')
        status = 'Connected'
      else status = 'Connection status unknown'
      renderItems.push(<QueryStatus key="querystatus" status={status} />)
      return <div>{renderItems}</div>
    }

    const speciesList = Object.keys(assemblies)
      .sort()
      .slice(0, 5)

    renderItems.push(
      <SelectBox
        key="speciesselect"
        selectList={speciesList}
        selectedItem={selectedSpecies}
        handleSelect={event => {
          this.setState({ selectedAssembly: '' })
          this.handleSelect('selectedSpecies')(event)
        }}
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
          handleSelect={event => {
            this.handleSelect('selectedAssembly')(event)
            this.getHubs(true)
          }}
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
