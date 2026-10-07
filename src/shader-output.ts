/**
 * Encodes `gl_FragColor.rgb` from the linear working space into the renderer's output color space:
 * sRGB on the canvas (so a `#8a9096` theme color draws as `#8a9096`), unchanged on linear render
 * targets. Alpha is left untouched, so anti-aliased coverage and blending are unaffected.
 *
 * Append once to every display fragment shader, after its final `gl_FragColor` assignment.
 * Requires a `ShaderMaterial` (not `RawShaderMaterial`), whose prefix defines `linearToOutputTexel`.
 */
export const OUTPUT_COLOR_SPACE_FRAGMENT = "#include <colorspace_fragment>";
