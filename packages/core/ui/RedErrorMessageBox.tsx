import React from 'react'

export default function RedErrorMessageBox({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        padding: 4,
        margin: 4,
        overflow: 'auto',
        maxHeight: 200,
        background: '#f88',
        border: '1px solid black',
      }}
    >
      {children}
    </div>
  )
}
