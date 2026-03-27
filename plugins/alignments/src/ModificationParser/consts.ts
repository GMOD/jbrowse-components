// Regexes based on the SAM spec MM:Z tag format:
// ([ACGTUN][-+]([a-z]+|[0-9]+)[.?]?(,[0-9]+)*;)*
// The base must be one of ACGTUN per spec. The modification code is lowercase
// letters or digits per spec, but the spec table also lists uppercase
// single-letter ambiguity codes (A, C, G, T, U, N) as valid mod codes.
// Modified to not have the ,(.*) because we saw examples with 'C+m,192,...;C+h;'
// and C+h does not have a comma
export const modificationRegex = new RegExp(
  /([ACGTUN])([-+])([a-z]+|[A-Z]|[0-9]+)([.?]?)/,
)
