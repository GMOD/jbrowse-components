"use client";

import { useMemo } from "react";
import { objectKeys } from "./tools/objectKeys";
import type { CSSObject } from "./types";
import { createUseCssAndCx } from "./cssAndCx";
import { getDependencyArrayRef } from "./tools/getDependencyArrayRef";
import { typeGuard } from "./tools/typeGuard";
import { assert } from "./tools/assert";
import { mergeClasses } from "./mergeClasses";
import type { EmotionCache } from "@emotion/cache";
// @ts-expect-error: not in the types but exists at runtime
import { __unsafe_useEmotionCache } from "@emotion/react";

const useContextualCache: () => EmotionCache = __unsafe_useEmotionCache;

let counter = 0;

export function createMakeStyles<Theme>(params: {
    useTheme: () => Theme;
}) {
    const { useTheme } = params;

    function useCache() {
        return useContextualCache();
    }

    const { useCssAndCx } = createUseCssAndCx({ useCache });

    function makeStyles<
        Params = void,
        RuleNameSubsetReferencableInNestedSelectors extends string = never
    >(params?: { name?: string | Record<string, unknown>; uniqId?: string }) {
        const { name: nameOrWrappedName, uniqId = `${counter++}` } =
            params ?? {};

        const name =
            typeof nameOrWrappedName !== "object"
                ? nameOrWrappedName
                : Object.keys(nameOrWrappedName)[0];

        return function <RuleName extends string>(
            cssObjectByRuleNameOrGetCssObjectByRuleName:
                | ((
                      theme: Theme,
                      params: Params,
                      classes: Record<
                          RuleNameSubsetReferencableInNestedSelectors,
                          string
                      >
                  ) => Record<
                      RuleName | RuleNameSubsetReferencableInNestedSelectors,
                      CSSObject
                  >)
                | Record<RuleName, CSSObject>
        ) {
            const getCssObjectByRuleName =
                typeof cssObjectByRuleNameOrGetCssObjectByRuleName ===
                "function"
                    ? cssObjectByRuleNameOrGetCssObjectByRuleName
                    : () => cssObjectByRuleNameOrGetCssObjectByRuleName;

            return function useStyles(
                params?: Params,
                muiStyleOverridesParams?: { props: { classes?: Record<string, string> } }
            ) {
                const theme = useTheme();

                const { css, cx } = useCssAndCx();

                const cache = useCache();

                let classes = useMemo(() => {
                    const refClassesCache: Record<string, string> = {};

                    type RefClasses = Record<
                        RuleNameSubsetReferencableInNestedSelectors,
                        string
                    >;

                    const refClasses =
                        typeof Proxy !== "undefined" &&
                        new Proxy<RefClasses>({} as RefClasses, {
                            "get": (_target, propertyKey) => {
                                if (typeof propertyKey === "symbol") {
                                    assert(false);
                                }

                                return (refClassesCache[propertyKey] = `${
                                    cache.key
                                }-${uniqId}${
                                    name !== undefined ? `-${name}` : ""
                                }-${propertyKey}-ref`);
                            }
                        });

                    const cssObjectByRuleName = getCssObjectByRuleName(
                        theme,
                        params as Params,
                        refClasses || ({} as RefClasses)
                    );

                    const classesResult: Record<string, string> = {};

                    for (const ruleName of objectKeys(cssObjectByRuleName)) {
                        const cssObject = cssObjectByRuleName[ruleName];

                        if (!cssObject.label) {
                            cssObject.label = `${
                                name !== undefined ? `${name}-` : ""
                            }${String(ruleName)}`;
                        }

                        classesResult[ruleName as string] = `${css(cssObject)}${
                            typeGuard<RuleNameSubsetReferencableInNestedSelectors>(
                                ruleName,
                                (ruleName as string) in refClassesCache
                            )
                                ? ` ${refClassesCache[ruleName as string]}`
                                : ""
                        }`;
                    }

                    for (const ruleName of objectKeys(refClassesCache)) {
                        if (ruleName in classesResult) {
                            continue;
                        }
                        classesResult[ruleName] = refClassesCache[ruleName]!;
                    }

                    return classesResult as Record<RuleName, string>;
                }, [cache, css, cx, theme, getDependencyArrayRef(params)]);

                // Merge with props.classes if provided
                {
                    const propsClasses = muiStyleOverridesParams?.props?.classes;

                    classes = useMemo(
                        () => mergeClasses(classes, propsClasses, cx),
                        [classes, getDependencyArrayRef(propsClasses), cx]
                    );
                }

                return {
                    classes,
                    theme,
                    css,
                    cx
                };
            };
        };
    }

    function useStyles() {
        const theme = useTheme();
        const { css, cx } = useCssAndCx();
        return { theme, css, cx };
    }

    return { makeStyles, useStyles };
}
