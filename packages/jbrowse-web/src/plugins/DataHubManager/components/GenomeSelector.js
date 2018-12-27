import { RaFile } from '@gmod/ucsc-hub'
import Card from '@material-ui/core/Card'
import CardActions from '@material-ui/core/CardActions'
import CardContent from '@material-ui/core/CardContent'
import CardHeader from '@material-ui/core/CardHeader'
import FormControl from '@material-ui/core/FormControl'
import FormHelperText from '@material-ui/core/FormHelperText'
import Icon from '@material-ui/core/Icon'
import IconButton from '@material-ui/core/IconButton'
import InputLabel from '@material-ui/core/InputLabel'
import LinearProgress from '@material-ui/core/LinearProgress'
import MenuItem from '@material-ui/core/MenuItem'
import Select from '@material-ui/core/Select'
import Typography from '@material-ui/core/Typography'
import PropTypes from 'prop-types'
import React from 'react'

class GenomeSelector extends React.Component {
  static propTypes = {
    hubTxtUrl: PropTypes.instanceOf(URL).isRequired,
    hubTxt: PropTypes.instanceOf(Map).isRequired,
    enableNext: PropTypes.func,
  }

  static defaultProps = {
    enableNext: () => {},
  }

  state = {
    networkAvailable: null,
    urlIsValid: null,
    genomesFileIsValid: null,
    errorMessage: '',
    genomesFile: new Map(),
    selectedGenome: '',
  }

  componentDidMount() {
    this.getGenomesFile()
  }

  getCardContent() {
    const {
      networkAvailable,
      urlIsValid,
      genomesFileIsValid,
      errorMessage,
      genomesFile,
      selectedGenome,
    } = this.state
    const { hubTxt, hubTxtUrl } = this.props
    if (networkAvailable === false)
      return (
        <Typography color="error">
          Network error. Cannot reach{' '}
          {new URL(hubTxt.get('genomesFile'), hubTxtUrl).href}
        </Typography>
      )
    if (urlIsValid === false)
      return (
        <Typography color="error">
          Could not find genomes file:{'\n'}
          {new URL(hubTxt.get('genomesFile'), hubTxtUrl).href}
        </Typography>
      )
    if (genomesFileIsValid === false)
      return (
        <Typography color="error">
          {errorMessage ||
            `Not a valid genomes file:\n${
              new URL(hubTxt.get('genomesFile'), hubTxtUrl).href
            }`}
        </Typography>
      )
    if (genomesFile.size > 0) {
      const menuItems = []
      genomesFile.forEach(genome => {
        const genomeName = genome.get('genome')
        menuItems.push(
          <MenuItem key={genomeName} value={genomeName}>
            {genomeName}
          </MenuItem>,
        )
      })
      return (
        <FormControl>
          <InputLabel>Genome</InputLabel>
          <Select value={selectedGenome} onChange={this.handleSelect}>
            {menuItems}
          </Select>
          <FormHelperText>Genomes available in this hub</FormHelperText>
        </FormControl>
      )
    }
    return <LinearProgress variant="query" />
  }

  async getGenomesFile() {
    const { hubTxt, hubTxtUrl } = this.props
    const response = await this.doGet(
      new URL(hubTxt.get('genomesFile'), hubTxtUrl),
    )
    if (!response) return
    const genomesFile = new RaFile(response)
    if (genomesFile.nameKey !== 'genome') {
      this.setState({
        genomesFileIsValid: false,
        errorMessage:
          'Genomes file must begin with a line like "genome <genome_name>"',
      })
      return
    }
    // TODO: check if genome is hosted by UCSC an if not, require twoBitPath and groups
    const requiredFields = [
      'genome',
      'trackDb',
      // 'twoBitPath',
      // 'groups',
    ]
    try {
      genomesFile.forEach(genome => {
        const missingFields = []
        requiredFields.forEach(field => {
          if (!genome.get(field)) missingFields.push(field)
        })
        if (missingFields.length > 0)
          throw new Error(
            `hub.txt is missing required entr${
              missingFields.length === 1 ? 'y' : 'ies'
            }: ${missingFields.join(', ')}`,
          )
      })
    } catch (e) {
      this.setState({
        genomesFileIsValid: false,
        errorMessage: e.message || '',
      })
    }
    this.setState({ genomesFileIsValid: true, genomesFile })
  }

  handleSelect = event => {
    const { enableNext } = this.props
    this.setState({ selectedGenome: event.target.value })
    enableNext()
  }

  async doGet(url) {
    let rawResponse
    try {
      rawResponse = await fetch(url)
    } catch {
      this.setState({ networkAvailable: false })
      return null
    }
    if (!rawResponse.ok) {
      this.setState({ urlIsValid: false })
      return null
    }
    return rawResponse.text()
  }

  render() {
    const { hubTxtUrl, hubTxt } = this.props
    return (
      <Card>
        <CardHeader
          title={hubTxt.get('shortLabel')}
          subheader={hubTxt.get('longLabel')}
        />
        <CardContent>{this.getCardContent()}</CardContent>
        <CardActions>
          <IconButton
            href={`mailto:${hubTxt.get('email')}`}
            rel="noopener noreferrer"
            target="_blank"
          >
            <Icon>email</Icon>
          </IconButton>
          {hubTxt.get('descriptionUrl') ? (
            <IconButton
              href={new URL(hubTxt.get('descriptionUrl'), hubTxtUrl).href}
              rel="noopener noreferrer"
              target="_blank"
            >
              <Icon>open_in_new</Icon>
            </IconButton>
          ) : null}
        </CardActions>
      </Card>
    )
  }
}

export default GenomeSelector
