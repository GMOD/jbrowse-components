import React from 'react'
import { CircularProgress } from '@mui/material'

export default function Loading() {
  return (
    <CircularProgress
      disableShrink
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        marginTop: -25,
        marginLeft: -25,
      }}
      size={50}
    />
  )
}
