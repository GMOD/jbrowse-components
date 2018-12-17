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
    hubTxtUrl: PropTypes.shape().isRequired,
    hubTxt: PropTypes.shape({
      hub: PropTypes.string.isRequired,
      shortLabel: PropTypes.string.isRequired,
      longLabel: PropTypes.string.isRequired,
      genomesFile: PropTypes.string.isRequired,
      email: PropTypes.string.isRequired,
      descriptionUrl: PropTypes.string,
    }).isRequired,
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
    genomesFile: [],
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
          {new URL(hubTxt.genomesFile, hubTxtUrl).href}
        </Typography>
      )
    if (urlIsValid === false)
      return (
        <Typography color="error">
          Could not find genomes file:{'\n'}
          {new URL(hubTxt.genomesFile, hubTxtUrl).href}
        </Typography>
      )
    if (genomesFileIsValid === false)
      return (
        <Typography color="error">
          {errorMessage ||
            `Not a valid genomes file:\n${
              new URL(hubTxt.genomesFile, hubTxtUrl).href
            }`}
        </Typography>
      )
    if (genomesFile.length > 0)
      return (
        <FormControl>
          <InputLabel>Genome</InputLabel>
          <Select value={selectedGenome} onChange={this.handleSelect}>
            {genomesFile.map(genome => (
              <MenuItem key={genome.genome} value={genome.genome}>
                {genome.genome}
              </MenuItem>
            ))}
          </Select>
          <FormHelperText>Genomes available in this hub</FormHelperText>
        </FormControl>
      )
    return <LinearProgress variant="query" />
  }

  async getGenomesFile() {
    const { hubTxt, hubTxtUrl } = this.props
    const genomesFile = await this.doGet(new URL(hubTxt.genomesFile, hubTxtUrl))
    if (!genomesFile) return
    if (!genomesFile.startsWith('genome ')) {
      this.setState({
        genomesFileIsValid: false,
        errorMessage:
          'Genomes file must begin with a line like "genome <genome_name>"',
      })
      return
    }
    const genomeFileParsed = []
    try {
      genomesFile.split(/(?:\r?\n){2,}/).forEach((genome, index) => {
        if (!genome.startsWith)
          throw new Error(
            `Each stanza in a genomes file must begin with a line like "genome <genome_name>"`,
          )
        genomeFileParsed.push({})
        genome.split(/[\r\n]+/).forEach(line => {
          if (line) {
            const sep = line.indexOf(' ')
            if (sep === -1)
              throw new Error(`Invalid line in genomes file:\n${line}`)
            const lineKey = line.slice(0, sep)
            genomeFileParsed[index][lineKey] = line.slice(sep + 1)
          }
        })
      })
    } catch (e) {
      this.setState({
        genomesFileIsValid: false,
        errorMessage: e.message || '',
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
      genomeFileParsed.forEach(genome => {
        const missingFields = []
        requiredFields.forEach(field => {
          if (!genome[field]) missingFields.push(field)
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
    this.setState({ genomesFileIsValid: true, genomesFile: genomeFileParsed })
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
        <CardHeader title={hubTxt.shortLabel} subheader={hubTxt.longLabel} />
        <CardContent>{this.getCardContent()}</CardContent>
        <CardActions>
          <IconButton
            href={`mailto:${hubTxt.email}`}
            rel="noopener noreferrer"
            target="_blank"
          >
            <Icon>email</Icon>
          </IconButton>
          {hubTxt.descriptionUrl ? (
            <IconButton
              href={new URL(hubTxt.descriptionUrl, hubTxtUrl).href}
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
