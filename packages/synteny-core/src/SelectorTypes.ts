import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { FileLocation } from '@jbrowse/core/util/types'
import type { IStateTreeNode, SnapshotIn } from '@jbrowse/mobx-state-tree'
import type React from 'react'

type Conf = SnapshotIn<AnyConfigurationModel>

export type ImportFormSyntenyTrack =
  | { type: 'preConfigured'; value: string }
  // value is undefined while "New track" is selected but the file hasn't been
  // provided yet (the pending state), then filled once an adapter is chosen
  | { type: 'userOpened'; value?: Conf }
  | { type: 'none' }

/**
 * The part of a view model the shared synteny import-form components read and
 * write; `ImportFormSyntenyMixin` supplies it.
 */
export interface ImportFormSyntenyModel {
  importFormSyntenyTrackSelections: ImportFormSyntenyTrack[]
  setImportFormSyntenyTrack: (idx: number, val: ImportFormSyntenyTrack) => void
  clearImportFormSyntenyTracks: () => void
}

export const helpStrings: Record<string, string> = {
  '.paf': 'minimap2 target.fa query.fa',
  '.pif.gz': 'minimap2 target.fa query.fa',
  '.out': 'mashmap target.fa query.fa',
  '.delta': 'mummer target.fa query.fa',
  '.chain': 'e.g. queryToTarget.chain',
}

export interface SelectorProps {
  assembly1: string
  assembly2: string
  swap: boolean
  setSwap: (swap: boolean) => void
  fileLocation?: FileLocation
  setFileLocation: (location: FileLocation) => void
  indexFileLocation?: FileLocation
  setIndexFileLocation?: (location: FileLocation) => void
  bed1Location?: FileLocation
  setBed1Location?: (location: FileLocation) => void
  bed2Location?: FileLocation
  setBed2Location?: (location: FileLocation) => void
  radioOption: string
}

// #region fileFormatOption
export interface SyntenyFileFormatOption {
  /** label and radio button value, e.g. '.maf' */
  extension: string
  /**
   * the tool that emits this format, e.g. 'minimap2'. Shown under the radio, so
   * a user who knows what produced their file can find it without matching
   * extensions. Optional: a format nobody would name by tool just omits it.
   */
  producer?: string
  Component: React.FC<{
    assembly1: string
    assembly2: string
    onAdapterChange: (r: { adapter: object; name: string } | undefined) => void
  }>
}
// #endregion

export interface SyntenyImportFormOptionProps {
  /** the view whose import form is open; `model.type` says which */
  model: ImportFormSyntenyModel & IStateTreeNode & { type: string }
  /** the pair of the form's rows the option configures; always 0 on a dotplot or circle */
  rowIndex: number
  /** the pair's first assembly: the upper row, the dotplot's y-axis, the circle's first genome */
  assembly1: string
  assembly2: string
}

// #region option
export interface SyntenyImportFormOption {
  /** unique identifier for the radio option */
  value: string
  /** display text for the radio option */
  label: string
  ReactComponent: React.FC<SyntenyImportFormOptionProps>
}
// #endregion

declare module '@jbrowse/core/PluginManager' {
  interface ExtensionPointRegistry {
    // #region registry
    'SyntenyImportForm-Options': {
      args: SyntenyImportFormOption[]
      result: SyntenyImportFormOption[]
      props: SyntenyImportFormOptionProps
    }
    // #endregion
    'SyntenyImportForm-FileFormats': {
      args: SyntenyFileFormatOption[]
      result: SyntenyFileFormatOption[]
    }
  }
}
