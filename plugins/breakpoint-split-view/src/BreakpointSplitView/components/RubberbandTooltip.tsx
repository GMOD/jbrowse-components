import { Tooltip } from '@mui/material'

export default function RubberbandTooltip({
  anchorEl,
  side,
  text,
}: {
  anchorEl: HTMLSpanElement
  side: string
  text: React.ReactNode
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
