import { makeStyles } from '@material-ui/core/styles'
import { observer } from 'mobx-react'
import React, { useState } from 'react'
import Typography from '@material-ui/core/Typography'
import MenuItem from '@material-ui/core/MenuItem'
import FormControl from '@material-ui/core/FormControl'
import Select from '@material-ui/core/Select'
import Icon from '@material-ui/core/Icon'
import Tooltip from '@material-ui/core/Tooltip'
import Table from '@material-ui/core/Table'
import TableBody from '@material-ui/core/TableBody'
import TableCell from '@material-ui/core/TableCell'
import TableHead from '@material-ui/core/TableHead'
import TableRow from '@material-ui/core/TableRow'
import { mutationHighlightFeatures } from './Utility'

const useStyles = makeStyles(theme => ({
  root: {
    padding: theme.spacing(1, 3, 1, 1),
    background: theme.palette.background.default,
    overflowX: 'hidden',
  },
  formControl: {
    margin: theme.spacing(1),
    minWidth: 150,
  },
  text: {
    display: 'flex',
    alignItems: 'center',
  },
}))

/**
 * Render a highlight/colour by element for colouring features
 */
export const MutationHighlightFeature = observer(({ schema }) => {
  const classes = useStyles()
  const [colourBy, setColourBy] = useState(schema.getColourBy())
  const handleChangeHighlightBy = event => {
    const hlBy = event.target.value
    setColourBy(hlBy)
    let colourFunction = ''
    if (hlBy.type === 'threshold') {
      colourFunction = `function(feature) { if (feature.get('${hlBy.attributeName}') >= ${hlBy.values[0].threshold}) {return '${hlBy.values[0].colour1}'; } else {return '${hlBy.values[0].colour2}'; } }`
    } else if (hlBy.type === 'category') {
      if (
        hlBy.name === 'VEP' ||
        hlBy.name === 'SIFT' ||
        hlBy.name === 'PolyPhen'
      ) {
        let switchStatement = `switch(impact) {`
        hlBy.values.forEach(element => {
          switchStatement += `case '${element.name}': return '${element.colour}'; break;`
        })
        switchStatement += '}'
        colourFunction = `function(feature) { const filteredConsequences = feature.get('consequence').hits.edges.filter(cons => cons.node.transcript.is_canonical); const impact = filteredConsequences[0].node.transcript.annotation.${hlBy.attributeName}; ${switchStatement}}`
      } else {
        let switchStatement = `switch(attrValue) {`
        hlBy.values.forEach(element => {
          switchStatement += `case '${element.name}': return '${element.colour}'; break;`
        })
        switchStatement += '}'
        colourFunction = `function(feature) { const attrValue = feature.get('${hlBy.attributeName}'); ${switchStatement}}`
      }
    } else {
      colourFunction = `function(feature) { return 'goldenrod' }`
    }
    // Set to function
    schema.target.renderer.color1.set(colourFunction)

    // Set to colour array element
    schema.setColourBy(JSON.stringify(hlBy))
    schema.target.adapter.colourBy.set(JSON.stringify(hlBy))
  }

  return (
    <>
      <Typography variant="h6" className={classes.text}>
        Colour Features
        <Tooltip
          title="Colour features on track based on feature attributes"
          aria-label="help"
          placement="right"
        >
          <Icon>help</Icon>
        </Tooltip>
      </Typography>
      <FormControl className={classes.formControl}>
        <Select
          labelId="category-select-label"
          id="category-select"
          value={colourBy}
          onChange={handleChangeHighlightBy}
        >
          <MenuItem disabled value="">
            <em>Attribute</em>
          </MenuItem>
          {mutationHighlightFeatures.map(element => {
            return (
              <MenuItem value={element} key={element.name}>
                {element.name}
              </MenuItem>
            )
          })}
        </Select>
      </FormControl>
      {colourBy && colourBy.values && (
        <div>
          <Typography variant="subtitle2" className={classes.text}>
            {colourBy.description}
          </Typography>
          {colourBy.values && colourBy.type === 'category' && (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Value</TableCell>
                  <TableCell>Colour</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {colourBy.values &&
                  colourBy.values.map(value => {
                    return (
                      <TableRow key={value.name}>
                        <TableCell>
                          {value.name !== '' ? value.name : 'n/a'}
                        </TableCell>
                        <TableCell>{value.colour}</TableCell>
                      </TableRow>
                    )
                  })}
              </TableBody>
            </Table>
          )}

          {colourBy.values && colourBy.type === 'threshold' && (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Value</TableCell>
                  <TableCell>Threshold</TableCell>
                  <TableCell>Below</TableCell>
                  <TableCell>Equal or Above</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {colourBy.values &&
                  colourBy.values.map(value => {
                    return (
                      <TableRow key={value.name}>
                        <TableCell>
                          {value.name !== '' ? value.name : 'n/a'}
                        </TableCell>
                        <TableCell>{value.threshold}</TableCell>
                        <TableCell>{value.colour2}</TableCell>
                        <TableCell>{value.colour1}</TableCell>
                      </TableRow>
                    )
                  })}
              </TableBody>
            </Table>
          )}
        </div>
      )}
    </>
  )
})
