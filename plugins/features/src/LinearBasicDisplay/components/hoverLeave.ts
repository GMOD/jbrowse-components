export function isCanvasWithId(target: EventTarget | null, canvasId: string) {
  return target instanceof HTMLCanvasElement && target.id === canvasId
}
