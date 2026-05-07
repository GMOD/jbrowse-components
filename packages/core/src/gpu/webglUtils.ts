export function splitPositionWithFrac(value: number): [number, number] {
  const intValue = Math.floor(value)
  const frac = value - intValue
  // Plain `intValue & 0xfff` would wrap for values > 2^31 because JS bitwise
  // ops are int32 — that's wrong for synteny across multi-gigabase genomes
  // where the cumulative-bp coordinate can run into the 10s of Gbp range.
  // Float64 modulo handles the full 2^53 safe range.
  const loInt = intValue - Math.floor(intValue / 4096) * 4096
  const hi = intValue - loInt
  const lo = loInt + frac
  return [hi, lo]
}

export function createShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
) {
  const shader = gl.createShader(type)!
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader)
    gl.deleteShader(shader)
    throw new Error(`Shader compile error: ${info}`)
  }
  return shader
}

export function createProgram(
  gl: WebGL2RenderingContext,
  vsSource: string,
  fsSource: string,
) {
  const vs = createShader(gl, gl.VERTEX_SHADER, vsSource)
  const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource)
  const program = gl.createProgram()
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)
  gl.detachShader(program, vs)
  gl.detachShader(program, fs)
  gl.deleteShader(vs)
  gl.deleteShader(fs)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program)
    gl.deleteProgram(program)
    throw new Error(`Program link error: ${info}`)
  }
  return program
}

export function bindUniformBlock(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  blockName: string,
  bindingPoint: number,
) {
  const idx = gl.getUniformBlockIndex(program, blockName)
  if (idx !== gl.INVALID_INDEX) {
    gl.uniformBlockBinding(program, idx, bindingPoint)
  }
}
