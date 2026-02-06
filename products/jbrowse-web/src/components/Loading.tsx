import { CircularProgress, Typography } from '@mui/material'

export default function Loading({ message }: { message?: string }) {
  return (
    <div
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
      }}
    >
      <CircularProgress disableShrink size={50} />
      {message ? <Typography>{message}</Typography> : null}
    </div>
  )
}
