import React from 'react'

export default function RedErrorMessageBox({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        background: '#f88',
        border: '1px solid black',
        margin: 4,
        maxHeight: 200,
        overflow: 'auto',
        padding: 4,
      }}
    >
      {children}
    </div>
  )
}
