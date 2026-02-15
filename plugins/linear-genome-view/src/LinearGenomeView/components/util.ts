import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'

export { fetchResults, splitLast } from '../../searchUtils.ts'

export function getRelativeX(
  event: { clientX: number; target: EventTarget | null },
  element: HTMLElement | null,
) {
  return event.clientX - (element?.getBoundingClientRect().left || 0)
}

export function getCytobands(assembly: Assembly | undefined, refName: string) {
  return (
    assembly?.cytobands
      ?.map(f => ({
        refName:
          assembly.getCanonicalRefName(f.get('refName')) || f.get('refName'),
        start: f.get('start'),
        end: f.get('end'),
        type: f.get('gieStain') as string,
        name: f.get('name'),
      }))
      .filter(f => f.refName === refName) || []
  )
}

export function joinElements(container: HTMLElement, count: number) {
  while (container.childElementCount > count) {
    container.lastElementChild!.remove()
  }
  while (container.childElementCount < count) {
    container.appendChild(document.createElement('div'))
  }
}

const MIN_DRAG_DISTANCE = 30

export function shouldSwapTracks(
  lastSwapY: number | undefined,
  currentY: number,
  movingDown: boolean,
) {
  return (
    lastSwapY === undefined ||
    (movingDown && currentY > lastSwapY + MIN_DRAG_DISTANCE) ||
    (!movingDown && currentY < lastSwapY - MIN_DRAG_DISTANCE)
  )
}
