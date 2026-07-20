'use client'

import { classnames } from './tools/classnames.ts'

import type { CxArg } from './tools/classnames.ts'

export { keyframes } from '@emotion/react'
export { makeStyles } from './mui/index.ts'

// Export cx as a standalone function (wrapper around classnames)

export function cx(...args: CxArg[]): string {
  return classnames(args)
}
