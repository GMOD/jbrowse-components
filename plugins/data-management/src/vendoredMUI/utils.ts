// Copied from @mui/material internal utilities
import generateUtilityClasses from '@mui/utils/generateUtilityClasses'
import generateUtilityClass from '@mui/utils/generateUtilityClass'

// From @mui/material/utils/createSimplePaletteValueFilter
function hasCorrectMainProperty(obj: any): boolean {
  return typeof obj.main === 'string'
}

export function createSimplePaletteValueFilter(
  additionalPropertiesToCheck: string[] = [],
) {
  return ([, value]: [any, any]) =>
    value &&
    hasCorrectMainProperty(value) &&
    additionalPropertiesToCheck.every(
      prop => value.hasOwnProperty(prop) && typeof value[prop] === 'string',
    )
}

// From @mui/material/utils/capitalize
export function capitalize(string: string): string {
  return string.charAt(0).toUpperCase() + string.slice(1)
}

// From @mui/material/styles/slotShouldForwardProp
function slotShouldForwardProp(prop: string) {
  return prop !== 'ownerState' && prop !== 'theme' && prop !== 'sx' && prop !== 'as'
}

// From @mui/material/styles/rootShouldForwardProp
export function rootShouldForwardProp(prop: string) {
  return slotShouldForwardProp(prop) && prop !== 'classes'
}

// From @mui/material/FormControl/formControlState
export function formControlState({
  props,
  states,
  muiFormControl,
}: {
  props: Record<string, any>
  states: string[]
  muiFormControl: any
}) {
  return states.reduce(
    (acc, state) => {
      acc[state] = props[state]
      if (muiFormControl) {
        if (typeof props[state] === 'undefined') {
          acc[state] = muiFormControl[state]
        }
      }
      return acc
    },
    {} as Record<string, any>,
  )
}

// From @mui/material/Checkbox/checkboxClasses
export function getCheckboxUtilityClass(slot: string) {
  return generateUtilityClass('MuiCheckbox', slot)
}
export const checkboxClasses = generateUtilityClasses('MuiCheckbox', [
  'root',
  'checked',
  'disabled',
  'indeterminate',
  'colorPrimary',
  'colorSecondary',
  'sizeSmall',
  'sizeMedium',
])

// From @mui/material/IconButton/iconButtonClasses
export function getIconButtonUtilityClass(slot: string) {
  return generateUtilityClass('MuiIconButton', slot)
}
export const iconButtonClasses = generateUtilityClasses('MuiIconButton', [
  'root',
  'disabled',
  'colorInherit',
  'colorPrimary',
  'colorSecondary',
  'colorError',
  'colorInfo',
  'colorSuccess',
  'colorWarning',
  'edgeStart',
  'edgeEnd',
  'sizeSmall',
  'sizeMedium',
  'sizeLarge',
  'loading',
  'loadingIndicator',
  'loadingWrapper',
])

// From @mui/material/FormControlLabel/formControlLabelClasses
export function getFormControlLabelUtilityClasses(slot: string) {
  return generateUtilityClass('MuiFormControlLabel', slot)
}
export const formControlLabelClasses = generateUtilityClasses(
  'MuiFormControlLabel',
  [
    'root',
    'labelPlacementStart',
    'labelPlacementTop',
    'labelPlacementBottom',
    'disabled',
    'label',
    'error',
    'required',
    'asterisk',
  ],
)

// Re-export memoTheme from @mui/system
export { unstable_memoTheme as memoTheme } from '@mui/system'
