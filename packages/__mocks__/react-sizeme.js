import React from 'react'

const sizeMeProps = {
  size: {
    height: 800,
    width: 808,
  },
}

export const withSize = () => SizedComponent => props =>
  <SizedComponent size={sizeMeProps.size} {...props} />
