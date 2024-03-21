import React from 'react'
import { CircularProgress } from '@mui/material'

export default function Loading() {
  return (
    <CircularProgress
      disableShrink
      style={{
        left: '50%',
        marginLeft: -25,
        marginTop: -25,
        position: 'fixed',
        top: '50%',
      }}
      size={50}
    />
  )
}
