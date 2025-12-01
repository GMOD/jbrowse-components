"use client";

export { keyframes } from "@emotion/react";
export { makeStyles } from "./mui";

// Export cx as a standalone function (wrapper around classnames)
import { classnames, type CxArg } from "./tools/classnames";
export function cx(...args: CxArg[]): string {
    return classnames(args);
}
