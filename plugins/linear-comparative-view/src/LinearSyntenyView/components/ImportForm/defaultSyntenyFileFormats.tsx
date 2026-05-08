import { useState } from 'react'

import { getFileName } from '@jbrowse/core/util/tracks'
import { observer } from 'mobx-react'

import {
  AnchorsSelector,
  PifGzSelector,
  StandardFormatSelector,
} from './selectors/index.ts'

import type { SyntenyFileFormatOption } from './selectors/SelectorTypes.ts'
import type { FileLocation } from '@jbrowse/core/util/types'

type OnAdapterChange = (
  r: { adapter: object; name: string } | undefined,
) => void

interface FormatProps {
  assembly1: string
  assembly2: string
  onAdapterChange: OnAdapterChange
}

function resolvedName(loc: FileLocation) {
  return getFileName(loc) || 'MyTrack'
}

function makeSimpleFormat(
  extension: string,
  adapterType: string,
  locationKey: string,
): SyntenyFileFormatOption {
  const Component = observer(function SyntenyFormat({
    assembly1,
    assembly2,
    onAdapterChange,
  }: FormatProps) {
    const [fileLocation, setFileLocation] = useState<FileLocation>()
    const [swap, setSwap] = useState(false)

    const buildAdapter = (loc: FileLocation, sw: boolean) => ({
      type: adapterType,
      [locationKey]: loc,
      queryAssembly: sw ? assembly2 : assembly1,
      targetAssembly: sw ? assembly1 : assembly2,
    })

    return (
      <StandardFormatSelector
        radioOption={extension}
        fileLocation={fileLocation}
        assembly1={assembly1}
        assembly2={assembly2}
        swap={swap}
        setFileLocation={loc => {
          setFileLocation(loc)
          onAdapterChange({ name: resolvedName(loc), adapter: buildAdapter(loc, swap) })
        }}
        setSwap={sw => {
          setSwap(sw)
          if (fileLocation) {
            onAdapterChange({
              name: resolvedName(fileLocation),
              adapter: buildAdapter(fileLocation, sw),
            })
          }
        }}
      />
    )
  })
  return { extension, Component }
}

function makeAnchorsFormat(
  extension: string,
  adapterType: string,
  locationKey: string,
): SyntenyFileFormatOption {
  const Component = observer(function AnchorsFormat({
    assembly1,
    assembly2,
    onAdapterChange,
  }: FormatProps) {
    const [fileLocation, setFileLocation] = useState<FileLocation>()
    const [bed1Location, setBed1Location] = useState<FileLocation>()
    const [bed2Location, setBed2Location] = useState<FileLocation>()
    const [swap, setSwap] = useState(false)

    const tryNotify = (
      fl: FileLocation | undefined,
      b1: FileLocation | undefined,
      b2: FileLocation | undefined,
      sw: boolean,
    ) => {
      if (fl && b1 && b2) {
        const a1 = sw ? assembly2 : assembly1
        const a2 = sw ? assembly1 : assembly2
        onAdapterChange({
          name: resolvedName(fl),
          adapter: {
            type: adapterType,
            [locationKey]: fl,
            bed1Location: b1,
            bed2Location: b2,
            assemblyNames: [a1, a2],
          },
        })
      } else {
        onAdapterChange(undefined)
      }
    }

    return (
      <AnchorsSelector
        radioOption={extension}
        fileLocation={fileLocation}
        assembly1={assembly1}
        assembly2={assembly2}
        swap={swap}
        bed1Location={bed1Location}
        bed2Location={bed2Location}
        setFileLocation={loc => {
          setFileLocation(loc)
          tryNotify(loc, bed1Location, bed2Location, swap)
        }}
        setBed1Location={loc => {
          setBed1Location(loc)
          tryNotify(fileLocation, loc, bed2Location, swap)
        }}
        setBed2Location={loc => {
          setBed2Location(loc)
          tryNotify(fileLocation, bed1Location, loc, swap)
        }}
        setSwap={sw => {
          setSwap(sw)
          tryNotify(fileLocation, bed1Location, bed2Location, sw)
        }}
      />
    )
  })
  return { extension, Component }
}

function makePifGzFormat(): SyntenyFileFormatOption {
  const Component = observer(function PifGzFormat({
    assembly1,
    assembly2,
    onAdapterChange,
  }: FormatProps) {
    const [fileLocation, setFileLocation] = useState<FileLocation>()
    const [indexFileLocation, setIndexFileLocation] = useState<FileLocation>()
    const [swap, setSwap] = useState(false)

    const tryNotify = (
      fl: FileLocation | undefined,
      idx: FileLocation | undefined,
      sw: boolean,
    ) => {
      if (fl && idx) {
        const a1 = sw ? assembly2 : assembly1
        const a2 = sw ? assembly1 : assembly2
        onAdapterChange({
          name: resolvedName(fl),
          adapter: {
            type: 'PairwiseIndexedPAFAdapter',
            pifGzLocation: fl,
            index: { location: idx },
            assemblyNames: [a1, a2],
          },
        })
      } else {
        onAdapterChange(undefined)
      }
    }

    return (
      <PifGzSelector
        radioOption=".pif.gz"
        fileLocation={fileLocation}
        assembly1={assembly1}
        assembly2={assembly2}
        swap={swap}
        indexFileLocation={indexFileLocation}
        setFileLocation={loc => {
          setFileLocation(loc)
          tryNotify(loc, indexFileLocation, swap)
        }}
        setIndexFileLocation={loc => {
          setIndexFileLocation(loc)
          tryNotify(fileLocation, loc, swap)
        }}
        setSwap={sw => {
          setSwap(sw)
          tryNotify(fileLocation, indexFileLocation, sw)
        }}
      />
    )
  })
  return { extension: '.pif.gz', Component }
}

export const defaultSyntenyFileFormats: SyntenyFileFormatOption[] = [
  makeSimpleFormat('.paf', 'PAFAdapter', 'pafLocation'),
  makeSimpleFormat('.delta', 'DeltaAdapter', 'deltaLocation'),
  makeSimpleFormat('.out', 'MashMapAdapter', 'outLocation'),
  makeSimpleFormat('.chain', 'ChainAdapter', 'chainLocation'),
  makeAnchorsFormat('.anchors', 'MCScanAnchorsAdapter', 'mcscanAnchorsLocation'),
  makeAnchorsFormat(
    '.anchors.simple',
    'MCScanSimpleAnchorsAdapter',
    'mcscanSimpleAnchorsLocation',
  ),
  makePifGzFormat(),
]
