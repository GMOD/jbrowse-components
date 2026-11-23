import { debug, writeJsonFile } from '../../utils.ts'

import type { Config } from '../../base.ts'

export function findAndUpdateOrAdd<
  I extends string,
  T extends Record<I, string>,
>({
  items,
  newItem,
  idField,
  force,
  itemType,
}: {
  items: T[]
  newItem: T
  idField: I
  force: boolean
  itemType: string
}): { updatedItems: T[]; wasOverwritten: boolean } {
  const newId = newItem[idField]
  const idx = items.findIndex(item => item[idField] === newId)

  if (idx !== -1) {
    debug(`Found existing ${itemType} ${newId} in configuration`)
    if (force) {
      debug(`Overwriting ${itemType} ${newId} in configuration`)
      const updatedItems = [...items]
      updatedItems[idx] = newItem
      return { updatedItems, wasOverwritten: true }
    } else {
      throw new Error(
        `Cannot add ${itemType} with ${idField} ${newId}, a ${itemType} with that ${idField} already exists`,
      )
    }
  } else {
    return { updatedItems: [...items, newItem], wasOverwritten: false }
  }
}

export async function saveConfigAndReport({
  config,
  target,
  itemType,
  itemName,
  itemId,
  wasOverwritten,
}: {
  config: Config
  target: string
  itemType: string
  itemName: string
  itemId?: string
  wasOverwritten: boolean
}): Promise<void> {
  debug(`Writing configuration to file ${target}`)
  await writeJsonFile(target, config)

  const idPart = itemId ? ` and ${itemType}Id "${itemId}"` : ''
  console.log(
    `${wasOverwritten ? 'Overwrote' : 'Added'} ${itemType} with name "${itemName}"${idPart} ${
      wasOverwritten ? 'in' : 'to'
    } ${target}`,
  )
}
