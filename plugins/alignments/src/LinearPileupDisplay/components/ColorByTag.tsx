/* eslint-disable no-nested-ternary */
import React, { useState } from 'react'
import { makeStyles } from '@material-ui/core/styles'
import Button from '@material-ui/core/Button'
import TextField from '@material-ui/core/TextField'
import Typography from '@material-ui/core/Typography'
import Dialog from '@material-ui/core/Dialog'
import MenuItem from '@material-ui/core/MenuItem'
import DialogContent from '@material-ui/core/DialogContent'
import DialogTitle from '@material-ui/core/DialogTitle'
import IconButton from '@material-ui/core/IconButton'
import AddIcon from '@material-ui/icons/Add'
import CloseIcon from '@material-ui/icons/Close'
import { ChromePicker, Color, ColorResult, RGBColor } from 'react-color'
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'
import * as d3 from 'd3-scale-chromatic'

const useStyles = makeStyles(theme => ({
  root: {
    width: 600,
  },
  colorPicker: {
    width: 225,
    height: 250,
  },
  closeButton: {
    position: 'absolute',
    right: theme.spacing(1),
    top: theme.spacing(1),
    color: theme.palette.grey[500],
  },
  formFields: {
    width: '30%',
    marginRight: 5,
  },
  popover: {
    position: 'absolute',
    zIndex: 2,
  },
}))

// this is needed because passing a entire color object into the react-color
// for alpha, can't pass in an rgba string for example
function serializeColor(color: Color) {
  if (color instanceof Object) {
    const { r, g, b, a } = color as RGBColor
    return `rgb(${r},${g},${b},${a})`
  }
  return color
}

export function ColorPicker(props: {
  color: Color
  onChange: (color: ColorResult) => void
  handleClose: () => void
}) {
  const { color, onChange, handleClose } = props
  const classes = useStyles()

  return (
    <Dialog
      open
      onClose={handleClose}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
    >
      <DialogTitle id="alert-dialog-title">
        Color Picker
        <IconButton
          aria-label="close"
          className={classes.closeButton}
          onClick={handleClose}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <div className={classes.colorPicker}>
          <div className={classes.popover}>
            <div
              role="presentation"
              className={classes.cover}
              onClick={handleClose}
            />
            <ChromePicker color={color} onChange={onChange} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
export default function ColorByTagDlg(props: {
  model: AnyConfigurationModel
  handleClose: () => void
}) {
  const classes = useStyles()
  const { model, handleClose } = props
  const [tag, setTag] = useState('')
  const [customName, setCustomName] = useState('')
  const [colorPalette, setColorPalette] = useState({ name: '', palette: [] })

  const emptyValue = { value: '', color: '' }
  const [valueState, setValueState] = useState([])
  const uniqueTags = new Set()
  const presetTags = new Set(['', 'HP', 'XS', 'TS', 'YC'])
  const [colors, setColors] = useState([
    'red',
    'yellow',
    'blue',
    'green',
    'orange',
    'Custom Color',
  ]) // randomly selected, need to change

  const colorPalettes = [
    'Category10',
    'Accent',
    'Dark2',
    'Paired',
    'Pastel1',
    'Pastel2',
    'Set1',
    'Set2',
    'Set3',
    'Tableau10',
    'Custom Palette',
  ]

  const [valueDisplayed, setValueDisplayed] = useState(false)

  // there should be a better way of accessing this
  // not sure if right tags
  model.displays[0].features.submaps[0].forEach(feature =>
    feature
      .tags()
      .filter(featTag => featTag.length === 2)
      .forEach(featureTag => {
        uniqueTags.add(featureTag)
      }),
  )

  const addValueRow = () => {
    setValueState([...valueState, { ...emptyValue }])
  }

  const handleValueChange = (e, idx) => {
    const updatedValues = [...valueState]
    updatedValues[idx][e.target.name] =
      e.target.name === 'value' ? parseInt(e.target.value, 10) : e.target.value
    setValueState(updatedValues)
  }

  const handleColorPickerChange = (e, idx) => {
    const colorChosen = serializeColor(e.rgb)
    if (!colors.includes(colorChosen)) setColors([colorChosen, ...colors])
    const updatedValues = [...valueState]
    updatedValues[idx].color = colorChosen
    setValueState(updatedValues)
  }

  const handleColorPickerClose = () => {
    // if open and close color picker without choice, reset
    setValueDisplayed(false)
  }

  return (
    <Dialog
      open
      onClose={handleClose}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
    >
      <DialogTitle id="alert-dialog-title">
        Color by tag
        <IconButton
          aria-label="close"
          className={classes.closeButton}
          onClick={handleClose}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Typography>Set the tag to color by</Typography>
        <div className={classes.root}>
          <form>
            <TextField
              id="standard-select-currency"
              select
              value={tag}
              onChange={event => {
                setTag(event.target.value)
                setValueState([])
              }}
              className={classes.formFields}
              helperText="Select Tag"
            >
              <MenuItem value="" />
              {Array.from(uniqueTags).map(uniqueTag => (
                <MenuItem key={uniqueTag} value={uniqueTag}>
                  {uniqueTag}
                </MenuItem>
              ))}
              <MenuItem value="customTag"> Custom Tag </MenuItem>
            </TextField>
            {!presetTags.has(tag) && tag === 'customTag' && (
              <TextField
                id="custom-name"
                onBlur={event => {
                  setCustomName(event.target.value)
                }}
                helperText="Set Custom Name"
                className={classes.formFields}
              />
            )}
            {!presetTags.has(tag) ? (
              <TextField
                id="color-palette"
                select
                value={colorPalette.name}
                onChange={e => {
                  console.log(e.target.value)
                  setColorPalette({
                    ...colorPalette,
                    name: e.target.value,
                    palette:
                      e.target.value !== 'Custom Palette'
                        ? d3[`scheme${e.target.value}`]
                        : [],
                  })
                }}
                className={classes.formFields}
                helperText="Select Color Palette"
              >
                <MenuItem value="" disabled selected>
                  Select Color Palette
                </MenuItem>
                {colorPalettes.map(paletteName => {
                  const paletteColors = d3[`scheme${paletteName}`]
                  return (
                    <MenuItem
                      key={paletteName}
                      value={paletteName}
                      style={{
                        background: paletteColors
                          ? `-webkit-linear-gradient(left, ${paletteColors.join()})`
                          : 'none',
                      }}
                    >
                      {paletteName}
                    </MenuItem>
                  )
                })}
              </TextField>
            ) : tag ? (
              <TextField
                id="preset-color"
                disabled
                placeholder="Using Preset Palette"
                helperText="Default Palette"
              />
            ) : null}
            {!presetTags.has(tag) &&
              colorPalette.name &&
              !colorPalette.palette.length && (
                <Button
                  startIcon={<AddIcon />}
                  variant="contained"
                  color="primary"
                  style={{ marginRight: 5 }}
                  onClick={() => addValueRow()}
                >
                  Add Value
                </Button>
              )}
            {valueState.map((val, idx) => {
              const valueId = `value-${idx}`
              const colorId = `color-${idx}`
              return (
                <div key={valueId}>
                  <TextField
                    id={valueId}
                    helperText="Set Value"
                    name="value"
                    className={classes.formFields}
                    value={valueState[idx].value}
                    onChange={e => handleValueChange(e, idx)}
                    data-idx={idx}
                  />
                  <TextField
                    select
                    id={colorId}
                    helperText="Color for Value"
                    name="color"
                    className={classes.formFields}
                    value={valueState[idx].color}
                    onChange={e => {
                      handleValueChange(e, idx)
                      if (e.target.value === 'Custom Color')
                        setValueDisplayed(true)
                    }}
                    data-idx={idx}
                  >
                    <MenuItem value="" disabled selected>
                      Select value color
                    </MenuItem>
                    {colors.map(color => (
                      <MenuItem
                        key={color}
                        value={color}
                        style={{ backgroundColor: color || 'none' }}
                      >
                        {color}
                      </MenuItem>
                    ))}
                  </TextField>
                  {valueDisplayed ? (
                    <ColorPicker
                      color={valueState[idx].color}
                      onChange={e => handleColorPickerChange(e, idx)}
                      handleClose={handleColorPickerClose}
                    />
                  ) : null}
                </div>
              )
            })}
            <Button
              variant="contained"
              color="primary"
              onClick={() => {
                const display = model.displays[0]
                ;(display.PileupDisplay || display).setColorScheme({
                  type: 'tag',
                  tag: tag !== 'customTag' ? tag : customName,
                  colorPalette: colorPalette.palette,
                  values: valueState,
                })
                handleClose()
              }}
              disabled={!tag || (!presetTags.has(tag) && !colorPalette.palette)}
            >
              Submit
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
