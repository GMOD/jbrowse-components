import type React from 'react'
import type { FileLocation } from '@jbrowse/core/util/types'

export interface SelectorProps {
  assembly1: string
  assembly2: string
  swap: boolean
  setSwap: (swap: boolean) => void
  fileLocation: FileLocation | undefined
  setFileLocation: (location: FileLocation | undefined) => void
  indexFileLocation?: FileLocation | undefined
  setIndexFileLocation?: (location: FileLocation | undefined) => void
  bed1Location?: FileLocation | undefined
  setBed1Location?: (location: FileLocation | undefined) => void
  bed2Location?: FileLocation | undefined
  setBed2Location?: (location: FileLocation | undefined) => void
  radioOption: string
}

export const helpStrings: Record<string, string> = {
  '.paf': 'minimap2 target.fa query.fa',
  '.pif.gz': 'minimap2 target.fa query.fa',
  '.out': 'mashmap target.fa query.fa',
  '.delta': 'mummer target.fa query.fa',
  '.chain': 'e.g. queryToTarget.chain',
}

export interface SyntenyFileFormatOption {
  extension: string
  Component: React.FC<{
    assembly1: string
    assembly2: string
    onAdapterChange: (r: { adapter: object; name: string } | undefined) => void
  }>
}
