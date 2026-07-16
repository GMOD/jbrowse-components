import { createJBrowseTheme } from '@jbrowse/core/ui'
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render } from '@testing-library/react'

import StatusChip from './StatusChip.tsx'

function renderChip(ui: React.ReactElement) {
  return render(
    <ThemeProvider theme={createJBrowseTheme()}>{ui}</ThemeProvider>,
  )
}

describe('StatusChip', () => {
  // Regression: onClick must receive the DOM click event. GeneGlyphControl
  // relies on event.stopPropagation()/currentTarget to open its menu without the
  // click bubbling to the track (drag-select/deselect); a `() => void` signature
  // dropped the event and threw on the first click.
  it('forwards the click event to onClick', () => {
    // read synchronously in the handler: React nulls currentTarget after dispatch
    let stopPropagationType: string | undefined
    let currentTargetIsElement = false
    const { getByText } = renderChip(
      <StatusChip
        icon={<UnfoldLessIcon />}
        label="Longest isoform"
        tooltip="tip"
        onClick={event => {
          stopPropagationType = typeof event.stopPropagation
          currentTargetIsElement = event.currentTarget instanceof HTMLElement
        }}
      />,
    )
    fireEvent.click(getByText('Longest isoform'))
    expect(stopPropagationType).toBe('function')
    expect(currentTargetIsElement).toBe(true)
  })

  it('fires onDelete when the (×) is clicked', () => {
    const onDelete = jest.fn()
    const { getByTestId } = renderChip(
      <StatusChip
        icon={<UnfoldLessIcon />}
        label="Longest isoform"
        tooltip="tip"
        onDelete={onDelete}
      />,
    )
    fireEvent.click(getByTestId('CancelIcon'))
    expect(onDelete).toHaveBeenCalledTimes(1)
  })
})
