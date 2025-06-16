import { Tooltip } from '@mui/material'

export default function RubberbandTooltip({
  anchorEl,
  side,
  text,
}: {
  anchorEl: HTMLSpanElement
  side: string
  text: string
}) {
  return (
    <Tooltip
      title={text}
      open
      placement={side === 'left' ? 'left-start' : 'right-start'}
      slotProps={{
        popper: {
          anchorEl,
          modifiers: [
            {
              name: 'offset',
              options: {
                // first number is y-offset (which docs refer to as skid),
                // second number is x-offset (which docs refer to as distance)
                offset: [-30, -10],
              },
            },
          ],
        },
      }}
    >
      <span></span>
    </Tooltip>
  )
}
