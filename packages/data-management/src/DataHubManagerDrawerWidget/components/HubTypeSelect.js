import FormControl from '@material-ui/core/FormControl'
import FormControlLabel from '@material-ui/core/FormControlLabel'
import FormHelperText from '@material-ui/core/FormHelperText'
import Link from '@material-ui/core/Link'
import Radio from '@material-ui/core/Radio'
import RadioGroup from '@material-ui/core/RadioGroup'
import propTypes from 'prop-types'
import React from 'react'

const hubTypeDescriptions = {
  ucsc: (
    <FormHelperText>
      A track or assembly hub in the{' '}
      <Link
        href="http://genome.ucsc.edu/goldenPath/help/hgTrackHubHelp.html#Intro"
        rel="noopener noreferrer"
        target="_blank"
      >
        Track Hub
      </Link>{' '}
      format
    </FormHelperText>
  ),
  jbrowse1: (
    <FormHelperText>
      A{' '}
      <Link
        href="https://jbrowse.org/"
        rel="noopener noreferrer"
        target="_blank"
      >
        JBrowse 1
      </Link>{' '}
      data directory
    </FormHelperText>
  ),
}

function HubTypeSelect(props) {
  const { hubType, setHubType } = props
  const hubTypes = [
    { value: 'ucsc', label: 'Track or Assembly Hub' },
    { value: 'jbrowse1', label: 'JBrowse Hub' },
  ]
  return (
    <FormControl component="fieldset">
      <RadioGroup value={hubType} onChange={setHubType}>
        {hubTypes.map(entry => (
          <FormControlLabel
            key={entry.value}
            control={<Radio />}
            value={entry.value}
            label={entry.label}
            disabled={entry.value === 'jbrowse1'}
            data-testid={entry.value}
          />
        ))}
      </RadioGroup>
      {hubTypeDescriptions[hubType]}
    </FormControl>
  )
}

HubTypeSelect.defaultProps = {
  hubType: undefined,
}

HubTypeSelect.propTypes = {
  hubType: propTypes.string,
  setHubType: propTypes.func.isRequired,
}

export default HubTypeSelect
