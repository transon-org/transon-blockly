// Shared mount options for the corpus UI harnesses (NFR-049 density, NFR-050 geometry).
//
// Empty palette via an all-filtering search: the §12.6 flat flyout renders EVERY palette block at
// mount (the old category toolbox rendered none until a category opened), costing seconds of jsdom
// rendering these harnesses don't need — they measure CANVAS blocks only and never read the
// flyout. One shared sentinel so the two suites cannot drift.
export const NO_PALETTE = { view: { search: 'no-palette (harness measures canvas only)' } };
