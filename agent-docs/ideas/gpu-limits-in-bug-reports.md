---
name: gpu-limits-in-bug-reports
description: A report from unseen GPU hardware names the adapter and omits every number that would explain the failure — the three limits are already being logged to a console nobody reads, so the change is to carry them on the capability object the stack-trace dialog copies.
---

# Put the GPU's limits in the report, not just its name

Every GPU number in this repo was measured on one machine (see
[../reference/GPU_PORTABILITY.md](../reference/GPU_PORTABILITY.md)). The gap
that closes cheaply is not a hardware lab — it is that a bug report from
hardware nobody here owns arrives without the budget the failure happened
inside.

**The numbers already exist at runtime.** `logGpuCapabilities` (`gpuDevice.ts`)
`console.warn`s vendor, architecture, description, `maxTextureDimension2D`,
`maxBufferSize` and `maxStorageBufferBindingSize` on every successful WebGPU
device acquisition. Its comment names the motivation exactly — "the whole point
of the GPU path is scaling across hardware we can't see" — and then writes to a
console that no report captures.

**The carrier already exists too.** `GraphicsCapabilities`
(`graphicsCapabilities.ts`) is what travels: the About widget's "Graphics:"
line, the stack-trace dialog the user chooses to copy, and one coarse
`softwareWebgl` bit to analytics. It answers *which GPU* and never *what it
allows*.

So the change is to move three numbers from the `console.warn` onto the
capability object, and show them where the dialog already shows the renderer.
A report then says "`maxBufferSize` 256 MiB" beside "this region is too large to
render", which is the difference between a reproducible ceiling and a guess.

**What to settle first, because it is the reason this is parked rather than
done:**

- **Which surface.** The stack-trace dialog is the one the user copies
  deliberately, and `glRenderer` is already scoped to it *and kept out of
  analytics* on fingerprinting grounds. Three integers are weaker
  fingerprinting signal than the unmasked renderer string, but they are not
  zero, and that call belongs with whoever owns the analytics boundary.
- **WebGL2 has no equivalent.** The limits above are WebGPU's. The WebGL2 path
  would need its own set (`MAX_TEXTURE_SIZE` is the one the guard actually
  trips on, and it is already queried in `webgl2Hal`), or the field is absent
  on exactly the backend whose ceiling is least queryable.
- **Absent is a value.** A machine that never got a device has no limits to
  report, and that is the most interesting report of all — it must not render
  as a blank row.

Not a bug: nothing is wrong today. It is that the one lever which generalizes
our GPU knowledge past a single laptop costs a few fields, and it is currently
being thrown away at the point it is generated.
