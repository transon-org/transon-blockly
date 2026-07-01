// Runtime toolbox configuration (FR-109): hide/reorder the committed `categoryToolbox` (projected by
// G_toolbox, §12.4) by category display name before it is handed to Blockly.inject. This is a pure
// filter over a COPY — the committed artifact is never mutated (AD-030/FR-127: the toolbox stays
// data-driven; an embedder chooses which of the fixed categories to show and in what order, it does
// not invent new ones). Unknown category names are reported, not silently dropped.

/** Embedder toolbox category configuration (FR-109). */
export interface ToolboxCategoryConfig {
  /** Category display names (§12.4) to hide from the toolbox. */
  hidden?: string[];
  /** Category display names in the desired leading order; categories not listed keep their original
   *  relative order after the listed ones. */
  order?: string[];
}

interface CategoryToolbox {
  kind: string;
  contents: Array<{ kind: string; name?: string; [k: string]: unknown }>;
}

function isCategoryToolbox(tb: unknown): tb is CategoryToolbox {
  return (
    !!tb &&
    typeof tb === 'object' &&
    Array.isArray((tb as { contents?: unknown }).contents)
  );
}

/**
 * Return a toolbox with the configured categories hidden and/or reordered. When `config` is empty
 * the original toolbox is returned unchanged. Any `hidden`/`order` name that is not an actual
 * category is passed to `onUnknown` (defaulting to a console warning) so a typo is surfaced rather
 * than silently ignored (FR-109).
 */
export function filterToolbox(
  toolbox: unknown,
  config: ToolboxCategoryConfig | undefined,
  onUnknown?: (names: string[]) => void,
): unknown {
  if (!config || (!config.hidden?.length && !config.order?.length)) return toolbox;
  if (!isCategoryToolbox(toolbox)) return toolbox;

  const names = new Set(
    toolbox.contents.map((c) => c.name).filter((n): n is string => typeof n === 'string'),
  );
  const referenced = [...(config.hidden ?? []), ...(config.order ?? [])];
  const unknown = referenced.filter((n) => !names.has(n));
  if (unknown.length) {
    (onUnknown ??
      ((n: string[]) =>
        // eslint-disable-next-line no-console
        console.warn(`[transon] unknown toolbox categories ignored: ${n.join(', ')}`)))(unknown);
  }

  const hidden = new Set(config.hidden ?? []);
  let contents = toolbox.contents.filter(
    (c) => !(typeof c.name === 'string' && hidden.has(c.name)),
  );

  if (config.order?.length) {
    const orderIdx = new Map(config.order.map((n, i) => [n, i]));
    const rank = (name: unknown): number =>
      typeof name === 'string' && orderIdx.has(name)
        ? orderIdx.get(name)!
        : Number.MAX_SAFE_INTEGER;
    // Array.prototype.sort is stable → unlisted categories keep their original relative order.
    contents = [...contents].sort((a, b) => rank(a.name) - rank(b.name));
  }

  return { ...toolbox, contents };
}
