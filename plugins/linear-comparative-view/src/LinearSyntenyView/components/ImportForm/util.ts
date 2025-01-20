import type { FileLocation } from '@jbrowse/core/util'

export function getName(
  sessionTrackData?: { uri: string } | { localPath: string } | { name: string },
) {
  return sessionTrackData
    ? // @ts-expect-error
      sessionTrackData.uri ||
        // @ts-expect-error
        sessionTrackData.localPath ||
        // @ts-expect-error
        sessionTrackData.name
    : undefined
}

export function stripGz(fileName: string) {
  return fileName.endsWith('.gz') ? fileName.slice(0, -3) : fileName
}

export function basename(str: string) {
  return str.split('#')[0]!.split('?')[0]!.split('/').pop()
}

export function extName(str: string) {
  const r = str.split('.').pop()
  return r ? `.${r}` : ''
}

export function getAdapter({
  radioOption,
  assembly1,
  assembly2,
  fileLocation,
  indexFileLocation,
  bed1Location,
  bed2Location,
}: {
  radioOption: string
  assembly1: string
  assembly2: string
  fileLocation?: FileLocation
  indexFileLocation?: FileLocation
  bed1Location?: FileLocation
  bed2Location?: FileLocation
}) {
  if (radioOption === '.paf') {
    return {
      type: 'PAFAdapter',
      pafLocation: fileLocation,
      queryAssembly: assembly1,
      targetAssembly: assembly2,
    }
  } else if (radioOption === '.out') {
    return {
      type: 'MashMapAdapter',
      outLocation: fileLocation,
      queryAssembly: assembly1,
      targetAssembly: assembly2,
    }
  } else if (radioOption === '.delta') {
    return {
      type: 'DeltaAdapter',
      deltaLocation: fileLocation,
      queryAssembly: assembly1,
      targetAssembly: assembly2,
    }
  } else if (radioOption === '.chain') {
    return {
      type: 'ChainAdapter',
      chainLocation: fileLocation,
      queryAssembly: assembly1,
      targetAssembly: assembly2,
    }
  } else if (radioOption === '.anchors') {
    return {
      type: 'MCScanAnchorsAdapter',
      mcscanAnchorsLocation: fileLocation,
      bed1Location,
      bed2Location,
      assemblyNames: [assembly1, assembly2],
    }
  } else if (radioOption === '.anchors.simple') {
    return {
      type: 'MCScanSimpleAnchorsAdapter',
      mcscanSimpleAnchorsLocation: fileLocation,
      bed1Location,
      bed2Location,
      assemblyNames: [assembly1, assembly2],
    }
  } else if (radioOption === '.pif.gz') {
    return {
      type: 'PairwiseIndexedPAFAdapter',
      pifGzLocation: fileLocation,
      index: { location: indexFileLocation },
      assemblyNames: [assembly1, assembly2],
    }
  } else {
    throw new Error(
      `Unknown to detect type ${radioOption} from filename (select radio button to clarify)`,
    )
  }
}
