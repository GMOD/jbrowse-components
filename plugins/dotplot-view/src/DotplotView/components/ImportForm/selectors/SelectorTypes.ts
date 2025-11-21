import type { FileLocation } from '@jbrowse/core/util/types'

export const helpStrings = {
  '.paf': 'minimap2 target.fa query.fa',
  '.pif.gz': 'minimap2 target.fa query.fa',
  '.out': 'mashmap target.fa query.fa',
  '.delta': 'mummer target.fa query.fa',
  '.chain': 'e.g. queryToTarget.chain',
} as const

export interface SelectorProps {
  assembly1?: string
  assembly2?: string
  swap?: boolean
  setSwap?: (arg: boolean) => void
  fileLocation?: FileLocation
  setFileLocation: (arg: FileLocation) => void
  indexFileLocation?: FileLocation
  setIndexFileLocation?: (arg: FileLocation) => void
  bed1Location?: FileLocation
  setBed1Location?: (arg: FileLocation) => void
  bed2Location?: FileLocation
  setBed2Location?: (arg: FileLocation) => void
  radioOption: string
}
