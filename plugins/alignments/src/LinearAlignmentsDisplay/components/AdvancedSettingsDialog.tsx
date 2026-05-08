import { useState } from 'react'

import { SubmitDialog } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  Checkbox,
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

const useStyles = makeStyles()({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    width: 400,
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
  },
})

interface AdvancedSettingsModel {
  mismatchAlpha?: boolean
  showInterbaseIndicators: boolean
  showOutlineSetting: boolean
  flipStrandLongReadChains: boolean
  maxHeight?: number
  coverageScaleType: string
  coverageAutoscaleType: string
  coverageMinScore?: number
  coverageMaxScore?: number
  toggleMismatchAlpha: () => void
  setShowInterbaseIndicators: (v: boolean) => void
  setShowOutline: (v: boolean) => void
  setFlipStrandLongReadChains: (v: boolean) => void
  setMaxHeight: (v?: number) => void
  setCoverageScaleType: (v: string) => void
  setCoverageAutoscaleType: (v: string) => void
  setCoverageMinScore: (v?: number) => void
  setCoverageMaxScore: (v?: number) => void
}

const AdvancedSettingsDialog = observer(function AdvancedSettingsDialog(props: {
  model: AdvancedSettingsModel
  handleClose: () => void
}) {
  const { model, handleClose } = props
  const { classes } = useStyles()

  const [mismatchAlpha, setMismatchAlpha] = useState(!!model.mismatchAlpha)
  const [showInterbaseIndicators, setShowInterbaseIndicators] = useState(
    model.showInterbaseIndicators,
  )
  const [showOutline, setShowOutline] = useState(model.showOutlineSetting)
  const [flipStrand, setFlipStrand] = useState(model.flipStrandLongReadChains)
  const [maxHeight, setMaxHeight] = useState(`${model.maxHeight ?? ''}`)
  const [scaleType, setScaleType] = useState(model.coverageScaleType)
  const [autoscaleType, setAutoscaleType] = useState(
    model.coverageAutoscaleType,
  )
  const [minScore, setMinScore] = useState(`${model.coverageMinScore ?? ''}`)
  const [maxScore, setMaxScore] = useState(`${model.coverageMaxScore ?? ''}`)

  return (
    <SubmitDialog
      open
      title="Advanced settings"
      onCancel={handleClose}
      onSubmit={() => {
        if (!!model.mismatchAlpha !== mismatchAlpha) {
          model.toggleMismatchAlpha()
        }
        model.setShowInterbaseIndicators(showInterbaseIndicators)
        model.setShowOutline(showOutline)
        model.setFlipStrandLongReadChains(flipStrand)
        model.setMaxHeight(
          maxHeight !== '' && !Number.isNaN(+maxHeight)
            ? +maxHeight
            : undefined,
        )
        model.setCoverageScaleType(scaleType)
        model.setCoverageAutoscaleType(autoscaleType)
        model.setCoverageMinScore(
          minScore !== '' && !Number.isNaN(+minScore) ? +minScore : undefined,
        )
        model.setCoverageMaxScore(
          maxScore !== '' && !Number.isNaN(+maxScore) ? +maxScore : undefined,
        )
        handleClose()
      }}
    >
      <div className={classes.root}>
        <div className={classes.section}>
          <Typography variant="subtitle2">Reads</Typography>
          <FormControlLabel
            control={
              <Checkbox
                checked={mismatchAlpha}
                onChange={() => {
                  setMismatchAlpha(v => !v)
                }}
              />
            }
            label="Show mismatches faded by quality"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={showInterbaseIndicators}
                onChange={() => {
                  setShowInterbaseIndicators(v => !v)
                }}
              />
            }
            label="Show interbase indicators"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={showOutline}
                onChange={() => {
                  setShowOutline(v => !v)
                }}
              />
            }
            label="Show outline on reads"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={flipStrand}
                onChange={() => {
                  setFlipStrand(v => !v)
                }}
              />
            }
            label="Show long read strand relative to primary"
          />
          <TextField
            value={maxHeight}
            label="Max track height (px)"
            onChange={event => {
              setMaxHeight(event.target.value)
            }}
          />
        </div>
        <div className={classes.section}>
          <Typography variant="subtitle2">Coverage</Typography>
          <FormControl>
            <FormLabel>Scale</FormLabel>
            <RadioGroup
              value={scaleType}
              onChange={event => {
                setScaleType(event.target.value)
              }}
            >
              <FormControlLabel
                value="linear"
                control={<Radio />}
                label="Linear"
              />
              <FormControlLabel value="log" control={<Radio />} label="Log" />
            </RadioGroup>
          </FormControl>
          <FormControl>
            <FormLabel>Autoscale</FormLabel>
            <RadioGroup
              value={autoscaleType}
              onChange={event => {
                setAutoscaleType(event.target.value)
              }}
            >
              <FormControlLabel
                value="local"
                control={<Radio />}
                label="Local"
              />
              <FormControlLabel
                value="localsd"
                control={<Radio />}
                label="Local ± 3σ"
              />
            </RadioGroup>
          </FormControl>
          <TextField
            value={minScore}
            label="Min score"
            onChange={event => {
              setMinScore(event.target.value)
            }}
          />
          <TextField
            value={maxScore}
            label="Max score"
            onChange={event => {
              setMaxScore(event.target.value)
            }}
          />
        </div>
      </div>
    </SubmitDialog>
  )
})

export default AdvancedSettingsDialog
