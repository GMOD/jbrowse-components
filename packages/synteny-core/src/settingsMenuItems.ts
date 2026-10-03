import { makeSizeSubMenu } from '@jbrowse/core/ui'
import { toggleItem } from '@jbrowse/core/ui/menuItems'
import { toLocale } from '@jbrowse/core/util'

import {
  DEFAULT_MIN_ALIGNMENT_LENGTH,
  MAX_MIN_LENGTH_BP,
  MIN_LENGTH_HELP,
} from './minLengthHelp.ts'

import type { SyntenyColorSurface } from './colorModes.ts'
import type { MenuItem } from '@jbrowse/core/ui'

/**
 * #api
 * The Opacity row of a view carrying `SyntenyViewMixin`, reset to that view's
 * own default. Under a field it moves the field's most opaque end.
 */
export function opacityMenuItem(model: {
  opacityLevel: number
  defaultOpacity: number
  setOpacity: (value: number) => void
  colorSurface: () => SyntenyColorSurface
}): MenuItem {
  return makeSizeSubMenu({
    label: 'opacity',
    title: 'Opacity',
    help: `Lower lets overlapping ${model.colorSurface()} show through each other.`,
    min: 0,
    max: 1,
    step: 0.01,
    // fine control near 0, where a small change is perceptually large
    scale: 'cubic',
    format: n => n.toFixed(3),
    getValue: () => model.opacityLevel,
    isDefault: model.opacityLevel === model.defaultOpacity,
    onChange: value => {
      model.setOpacity(value)
    },
    onReset: () => {
      model.setOpacity(model.defaultOpacity)
    },
  })
}

/**
 * #api
 * The Identity fade toggle of a view carrying `SyntenyViewMixin`: `opacity`
 * read from `identity`, or back to the constant.
 */
export function identityFadeMenuItem(model: {
  opacityField: string
  setOpacityField: (field: string) => void
}): MenuItem {
  return toggleItem(
    'Identity fade',
    model.opacityField === 'identity',
    v => {
      model.setOpacityField(v ? 'identity' : '')
    },
    {
      helpText:
        'Fade each ribbon by its sequence identity, whatever the color mode.',
    },
  )
}

/**
 * #api
 * The Min length row of a view carrying `SyntenyViewMixin`.
 */
export function minLengthMenuItem(model: {
  minAlignmentLength: number
  setMinAlignmentLength: (value: number) => void
}): MenuItem {
  return makeSizeSubMenu({
    label: 'min length',
    title: 'Min length',
    help: MIN_LENGTH_HELP,
    min: DEFAULT_MIN_ALIGNMENT_LENGTH,
    max: MAX_MIN_LENGTH_BP,
    step: 1,
    scale: 'log',
    format: n => `${toLocale(n)}bp`,
    commitOnRelease: true,
    getValue: () => model.minAlignmentLength,
    isDefault: model.minAlignmentLength === DEFAULT_MIN_ALIGNMENT_LENGTH,
    onChange: bp => {
      model.setMinAlignmentLength(bp)
    },
    onReset: () => {
      model.setMinAlignmentLength(DEFAULT_MIN_ALIGNMENT_LENGTH)
    },
  })
}
