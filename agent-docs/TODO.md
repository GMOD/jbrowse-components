  The key issue: createTargetDirectory (a mkdirSync side effect) runs at line 192, before validateLoadAndLocation, validateAdapterType, validateAssemblies, and the duplicate-trackId check. So a command
  that fails validation can still leave an empty subDir behind on disk.

  Let me reorder so all validation completes before any directory is created.

● Update(products/jbrowse-cli/src/commands/add-track.ts)
  ⎿  Added 3 lines, removed 3 lines
      186      adapterType,
      187    } = flags
      188
      189 +  const location = track!
      190 +  validateLoadAndLocation(location, load)
      191 +
      192    const targetConfigPath = await resolveConfigPath(target, out)
      193    const configDir = path.dirname(targetConfigPath)
      194
      192 -  createTargetDirectory(configDir, subDir)
      193 -  const location = track!
      194 -
      195    const mapLoc = (p: string) => mapLocationForFiles(p, load, subDir)
      196    const mapOpt = (p?: string) => (p ? mapLoc(p) : undefined)

