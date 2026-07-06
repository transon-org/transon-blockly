// Runtime toolbox configuration (FR-109 categories + §12.6 progressive disclosure): hide/reorder the
// committed `categoryToolbox` (projected by G_toolbox, §12.4) before it is handed to Blockly.inject /
// updateToolbox. All pure filters over a COPY — the committed artifact is never mutated (AD-030/
// FR-127: the toolbox stays data-driven; advanced-ness comes from the committed presentation data,
// not a TS literal). Unknown category names are reported, not silently dropped.

import { PRESENTATION } from '@transon/editor-core';

const RULE_TYPE_PREFIX = 'transon_rule_';

/** The rule name a palette block type projects (`transon_rule_<rule>__<variant>`), or undefined for
 *  structural/non-rule types. Rule names carry no `__`, so the rule is the segment before it. */
function ruleOfType(type: unknown): string | undefined {
  if (typeof type !== 'string' || !type.startsWith(RULE_TYPE_PREFIX)) return undefined;
  return type.slice(RULE_TYPE_PREFIX.length).split('__')[0] || undefined;
}

/** Is this block type an `advanced` rule (§12.6)? Read from the committed presentation data (FR-127),
 *  never a hardcoded rule list. */
function isAdvancedType(type: unknown): boolean {
  const rule = ruleOfType(type);
  return !!rule && PRESENTATION.rules[rule]?.advanced === true;
}

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

/** Progressive-disclosure view over the toolbox (§12.6, OQ-009). */
export interface ToolboxView {
  /** Show `advanced` blocks (parent/set/get/zip/file/include, §12.6). Default false. */
  showAdvanced?: boolean;
  /** Filter palette blocks to those whose rule/type contains this term (case-insensitive). */
  search?: string;
}

/**
 * Apply the progressive-disclosure view (§12.6): hide `advanced` blocks unless `showAdvanced`, and
 * filter blocks by a search term. Categories emptied by the filter are dropped. Pure over a copy.
 */
export function progressiveToolbox(toolbox: unknown, view: ToolboxView): unknown {
  const showAdvanced = view.showAdvanced ?? false;
  const term = (view.search ?? '').trim().toLowerCase();
  if (showAdvanced && !term) return toolbox; // nothing to hide
  if (!isCategoryToolbox(toolbox)) return toolbox;

  const blockMatches = (block: { kind: string; type?: unknown }): boolean => {
    if (block.kind !== 'block') return true; // keep separators/labels/buttons
    if (!showAdvanced && isAdvancedType(block.type)) return false;
    if (term) {
      const type = typeof block.type === 'string' ? block.type.toLowerCase() : '';
      const rule = (ruleOfType(block.type) ?? '').toLowerCase();
      if (!type.includes(term) && !rule.includes(term)) return false;
    }
    return true;
  };

  const contents = toolbox.contents
    .map((cat) => {
      if (cat.kind !== 'category' || !Array.isArray(cat.contents)) return cat;
      return { ...cat, contents: cat.contents.filter(blockMatches) };
    })
    .filter(
      (cat) =>
        !(cat.kind === 'category' && Array.isArray(cat.contents) && cat.contents.length === 0),
    );

  return { ...toolbox, contents };
}

/**
 * Flatten a `categoryToolbox` into the palette's presentation form (§12.6): a `flyoutToolbox` —
 * one always-visible scrolling list — where each §12.4 category becomes an inline divider label
 * followed by its contents. A pure view over a copy: the committed artifact is never mutated
 * (AD-030/FR-127). Apply AFTER `filterToolbox` (FR-109) and `progressiveToolbox` (§12.6), which
 * operate on the category form and already drop emptied categories (no orphan dividers).
 */
export function flattenToolbox(toolbox: unknown): unknown {
  if (!isCategoryToolbox(toolbox)) return toolbox;
  const contents = toolbox.contents.flatMap((item) => {
    if (item.kind !== 'category' || !Array.isArray(item.contents)) return [item];
    return [
      { kind: 'label', text: item.name ?? '', 'web-class': 'transonFlyoutDivider' },
      ...(item.contents as unknown[]),
    ];
  });
  return { kind: 'flyoutToolbox', contents };
}
