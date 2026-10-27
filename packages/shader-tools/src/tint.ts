/// <reference types="@webgpu/types" />

// Tint, through Dawn's node binding, is the WGSL validator Chrome runs, and it
// rejects shaders naga accepts: a derivative in non-uniform control flow passes
// naga 30 and fails `createShaderModule` in the browser. Dawn's null backend
// needs no GPU, so this runs wherever node does.

export type WgslValidator = (wgsl: string) => Promise<string | undefined>

const CONTEXT_LINES = 2

function excerpt(wgsl: string, lineNum: number, linePos: number) {
  const lines = wgsl.split('\n')
  const first = Math.max(1, lineNum - CONTEXT_LINES)
  const last = Math.min(lines.length, lineNum + CONTEXT_LINES)
  const out: string[] = []
  for (let n = first; n <= last; n++) {
    out.push(`${String(n).padStart(5)} | ${lines[n - 1]}`)
    if (n === lineNum) {
      out.push(`${' '.repeat(5)} | ${' '.repeat(Math.max(0, linePos - 1))}^`)
    }
  }
  return out.join('\n')
}

export function formatCompilationInfo(
  wgsl: string,
  messages: readonly Pick<
    GPUCompilationMessage,
    'type' | 'lineNum' | 'linePos' | 'message'
  >[],
) {
  const errors = messages.filter(m => m.type === 'error')
  if (errors.length === 0) {
    return undefined
  }
  const notes = messages.filter(m => m.type !== 'error')
  return [
    ...errors.flatMap(e => [
      `slangc's WGSL ${e.lineNum}:${e.linePos}: error: ${e.message}`,
      excerpt(wgsl, e.lineNum, e.linePos),
    ]),
    ...notes.map(n => `  ${n.type} ${n.lineNum}:${n.linePos}: ${n.message}`),
  ].join('\n')
}

// dawn.node does not keep a device's parents alive, and a collected GPU or
// adapter under a live device aborts the process at exit.
const pinned: unknown[] = []

/** Undefined when the optional `webgpu` package is not installed. */
export async function openTint(): Promise<WgslValidator | undefined> {
  const webgpu = await import('webgpu').catch(() => undefined)
  if (!webgpu) {
    return undefined
  }
  const gpu = webgpu.create(['backend=null'])
  const adapter = await gpu.requestAdapter()
  if (!adapter) {
    throw new Error(`Dawn's null backend offered no adapter`)
  }
  const device = await adapter.requestDevice()
  pinned.push(gpu, adapter, device)
  return wgslValidator(device)
}

export function wgslValidator(device: GPUDevice): WgslValidator {
  return async wgsl => {
    // The scope captures what Dawn would otherwise print to stderr as an
    // uncaptured error; the compilation info carries the same diagnostic.
    device.pushErrorScope('validation')
    const module = device.createShaderModule({ code: wgsl })
    const info = await module.getCompilationInfo()
    await device.popErrorScope()
    return formatCompilationInfo(wgsl, info.messages)
  }
}
