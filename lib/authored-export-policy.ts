/** Project-bearing exports must either remain authored or fail explicitly. */
export const mustBlockLegacyFallback = (persistedProjectCount: number) => persistedProjectCount > 0;
