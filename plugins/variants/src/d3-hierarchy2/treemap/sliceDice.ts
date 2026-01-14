// @ts-nocheck
import dice from "./dice.ts";
import slice from "./slice.ts";

export default function(parent, x0, y0, x1, y1) {
  (parent.depth & 1 ? slice : dice)(parent, x0, y0, x1, y1);
}
