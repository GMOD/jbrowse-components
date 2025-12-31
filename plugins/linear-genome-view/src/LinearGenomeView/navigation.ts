import {
  assembleLocString,
  clamp,
  findLast,
  getSession,
} from '@jbrowse/core/util'
import { moveTo } from '@jbrowse/core/util/Base1DUtils'
import { when } from 'mobx'

import { generateLocations, parseLocStrings } from './util'

import type { LinearGenomeViewModel } from './model'
import type { NavLocation } from './types'
import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { ParsedLocString } from '@jbrowse/core/util'

/**
 * Navigate to the given locstring, will change displayed regions if
 * needed, and wait for assemblies to be initialized
 *
 * @param self - the LinearGenomeViewModel
 * @param input - e.g. "chr1:1-100", "chr1:1-100 chr2:1-100", "chr 1 100"
 * @param optAssemblyName - (optional) the assembly name to use
 * @param grow - (optional) factor to grow the region by
 */
export async function navToLocString(
  self: LinearGenomeViewModel,
  input: string,
  optAssemblyName?: string,
  grow?: number,
) {
  const { assemblyNames } = self
  const { assemblyManager } = getSession(self)
  const assemblyName = optAssemblyName || assemblyNames[0]!
  if (assemblyName) {
    await assemblyManager.waitForAssembly(assemblyName)
  }

  return navToLocations(
    self,
    parseLocStrings(input, assemblyName, (ref, asm) =>
      assemblyManager.isValidRefName(ref, asm),
    ),
    assemblyName,
    grow,
  )
}

/**
 * Similar to `navToLocString`, but accepts a parsed location object
 * instead of a locstring. Will try to perform `setDisplayedRegions` if
 * changing regions
 */
export async function navToLocation(
  self: LinearGenomeViewModel,
  parsedLocString: ParsedLocString,
  assemblyName?: string,
  grow?: number,
) {
  return navToLocations(self, [parsedLocString], assemblyName, grow)
}

/**
 * Similar to `navToLocString`, but accepts a list of parsed location
 * objects instead of a locstring. Will try to perform
 * `setDisplayedRegions` if changing regions
 */
export async function navToLocations(
  self: LinearGenomeViewModel,
  regions: ParsedLocString[],
  assemblyName?: string,
  grow?: number,
) {
  const { assemblyManager } = getSession(self)
  await when(() => self.volatileWidth !== undefined)

  // Generate locations from the parsed regions
  const locations = await generateLocations({
    regions,
    assemblyManager,
    assemblyName,
    grow,
  })

  // Handle single location case
  if (locations.length === 1) {
    const location = locations[0]!
    const { reversed, parentRegion, start, end } = location

    // Set the displayed region based on the parent region
    self.setDisplayedRegions([
      {
        reversed,
        ...parentRegion,
      },
    ])

    // Navigate to the specific coordinates within the region
    navTo(self, {
      ...location,
      start: clamp(start ?? 0, 0, parentRegion.end),
      end: clamp(end ?? parentRegion.end, 0, parentRegion.end),
    })
  }
  // Handle multiple locations case
  else {
    self.setDisplayedRegions(
      locations.map(location => {
        const { start, end } = location
        return start === undefined || end === undefined
          ? location.parentRegion
          : {
              ...location,
              start,
              end,
            }
      }),
    )
    self.showAllRegions()
  }
}

/**
 * Navigate to a location based on its refName and optionally start, end,
 * and assemblyName. Will not try to change displayed regions.
 * Only navigates to a location if it is entirely within a displayedRegion.
 *
 * Throws an error if navigation was unsuccessful
 *
 * @param self - the LinearGenomeViewModel
 * @param query - a proposed location to navigate to
 */
export function navTo(self: LinearGenomeViewModel, query: NavLocation) {
  navToMultiple(self, [query])
}

/**
 * Navigate to multiple locations. Will not try to change displayed regions.
 * Only navigates if locations are entirely within displayedRegions.
 *
 * Throws an error if navigation was unsuccessful
 *
 * @param self - the LinearGenomeViewModel
 * @param locations - proposed locations to navigate to
 */
export function navToMultiple(
  self: LinearGenomeViewModel,
  locations: NavLocation[],
) {
  if (
    locations.some(
      l => l.start !== undefined && l.end !== undefined && l.start > l.end,
    )
  ) {
    throw new Error('found start greater than end')
  }

  const firstLocation = locations.at(0)
  const lastLocation = locations.at(-1)
  if (!firstLocation || !lastLocation) {
    return
  }

  // Get assembly information
  const defaultAssemblyName = self.assemblyNames[0]!
  const { assemblyManager } = getSession(self)

  // Process first location
  const firstAssembly = assemblyManager.get(
    firstLocation.assemblyName || defaultAssemblyName,
  )
  const firstRefName =
    firstAssembly?.getCanonicalRefName(firstLocation.refName) ||
    firstLocation.refName
  const firstRegion = self.displayedRegions.find(r => r.refName === firstRefName)

  // Process last location
  const lastAssembly = assemblyManager.get(
    lastLocation.assemblyName || defaultAssemblyName,
  )
  const lastRefName =
    lastAssembly?.getCanonicalRefName(lastLocation.refName) ||
    lastLocation.refName
  const lastRegion = findLast(
    self.displayedRegions,
    r => r.refName === lastRefName,
  )

  // Validate regions exist
  if (!firstRegion) {
    throw new Error(`could not find a region with refName "${firstRefName}"`)
  }
  if (!lastRegion) {
    throw new Error(`could not find a region with refName "${lastRefName}"`)
  }

  // Calculate coordinates, using region bounds if not specified
  const firstStart =
    firstLocation.start === undefined ? firstRegion.start : firstLocation.start
  const firstEnd =
    firstLocation.end === undefined ? firstRegion.end : firstLocation.end
  const lastStart =
    lastLocation.start === undefined ? lastRegion.start : lastLocation.start
  const lastEnd =
    lastLocation.end === undefined ? lastRegion.end : lastLocation.end

  // Find region indices that contain our locations
  const firstIndex = self.displayedRegions.findIndex(
    r =>
      firstRefName === r.refName &&
      firstStart >= r.start &&
      firstStart <= r.end &&
      firstEnd <= r.end &&
      firstEnd >= r.start,
  )

  const lastIndex = self.displayedRegions.findIndex(
    r =>
      lastRefName === r.refName &&
      lastStart >= r.start &&
      lastStart <= r.end &&
      lastEnd <= r.end &&
      lastEnd >= r.start,
  )

  if (firstIndex === -1 || lastIndex === -1) {
    throw new Error(
      `could not find a region that contained "${locations.map(l =>
        assembleLocString(l),
      )}"`,
    )
  }

  const startDisplayedRegion = self.displayedRegions[firstIndex]!
  const endDisplayedRegion = self.displayedRegions[lastIndex]!

  // Calculate offsets, accounting for reversed regions
  const startOffset = startDisplayedRegion.reversed
    ? startDisplayedRegion.end - firstEnd
    : firstStart - startDisplayedRegion.start

  const endOffset = endDisplayedRegion.reversed
    ? endDisplayedRegion.end - lastStart
    : lastEnd - endDisplayedRegion.start

  moveTo(
    self,
    {
      index: firstIndex,
      offset: startOffset,
    },
    {
      index: lastIndex,
      offset: endOffset,
    },
  )
}
