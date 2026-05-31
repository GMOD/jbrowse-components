
  In the current shader, the fragIn.dist essentially acts as a 1D SDF of the line's centerline. To
  feather it out properly, we can improve the fragment shader to treat the arc as a proper SDF-defined
  shape, which allows for much smoother edges regardless of line orientation.

  Here is how we can implement this:

  Proposed Changes

   1. Enhance VsOut: We currently have dist (distance from the centerline). We might need to pass
      information about the position along the tangent (alongTangent) to handle cap rounding, as
      suggested in OTHER_IDEAS.md.
   2. Modify Fragment Shader: Instead of just using fwidth on the distance, we can use a smoother
      interpolation function (smoothstep) and add a slight blur factor to feather the edges.

  Updated Fragment Shader Logic (Conceptual)

    1 [shader("fragment")]
    2 float4 fs_main(VsOut fragIn) : SV_Target {
    3   // Existing dash logic
    4   if (fragIn.dashed > 0.5 && frac(fragIn.position.x / 6.0) > 0.5) { discard; }
    5
    6   float hw = u.lineWidthPx * 0.5;
    7   float d = abs(fragIn.dist);
    8
    9   // Instead of fwidth, use a fixed small feather amount for consistent softness
   10   // OR keep fwidth but refine the transition.
   11   float feather = 0.8; // Adjust for desired softness
   12   float alpha = 1.0 - smoothstep(hw - feather, hw + feather, d);
   13
   14   // If you also want to round the caps as mentioned in the docs, you would
   15   // use the along-tangent distance to discard fragments outside the caps:
   16   // if (abs(fragIn.alongTangent) > (totalLength - hw)) { ... discard or soften ... }
   17
   18   return float4(fragIn.color.rgb, fragIn.color.a * alpha);
   19 }

  Why this fixes the horizontal pixelation:

   * Consistency: Using smoothstep with a constant feather value creates a predictable, sub-pixel
     transition that is independent of how the line aligns with the pixel grid.
   * Aliasing: fwidth can produce noisy results if the geometry is degenerate or very thin, whereas a
     dedicated SDF function is mathematically continuous.

  Would you like me to prepare a plan to apply these changes to
  plugins/alignments/src/LinearAlignmentsDisplay/shaders/slang/arc.slang? I'll need to update the
  VsOut struct to pass the tangent data if we want to include rounded caps as well.


