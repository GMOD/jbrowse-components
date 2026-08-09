/**
 * Slang suffixes an emitted name with a disambiguating index (`color` ->
 * `color_1`), and the index isn't stable across shaders — it counts every
 * declaration slangc has seen, so adding an unrelated function upstream can
 * renumber it. Strip it to get back the name the shader author wrote.
 *
 * Both readers of slangc's emitted source text need this rule and had their own
 * copy: `assertVertexInputs` matching declared vertex inputs against the
 * reflected struct, and `wgslToJs` resolving a `//! js-export` name to the
 * function slangc actually emitted.
 */
export const demangle = (name: string) => name.replace(/_\d+$/, '')
