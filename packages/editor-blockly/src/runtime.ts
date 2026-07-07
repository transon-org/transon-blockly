// The finite, rule-agnostic Blockly behavior runtime (AD-031, NFR-046, §13).
//
// This is the ONLY first-party Blockly *code* in the editor surface. Block *structure* is
// projected from metadata (G_palette/G_toolbox, AD-026); only the behavior JSON cannot express —
// an editable scalar field, a generic curated dropdown field, and the dynamic-arity /
// raw-preserving structural blocks — lives here. It is keyed by the fixed STRUCTURAL block
// vocabulary (transon_array / transon_object_literal / transon_unsupported) and the two custom
// fields, NEVER by rule name: a new rule rides entirely on metadata + projections and adds
// NOTHING here (NFR-046, enforced by check_behavior_runtime_size).
//
// Three behaviors beyond M3's headless state hooks (M4/M5):
//  - FR-015: the scalar field is *editable* (a text editor that parses to a typed JSON scalar, so
//    type fidelity — 42 vs "42" vs true vs null — survives the codec).
//  - FR-130 / §13.6: the generic dropdown field accepts every metadata-valid token (not just the
//    curated menu entries) — an alias token loads, displays verbatim, and round-trips verbatim
//    without ever being rewritten to its canonical spelling (display-only curation, AD-004).
//  - AC-038 / §13.13: each dynamic-arity block exposes on-canvas +/- buttons (the mutator UI) to
//    add/remove items (array) or key/value fields (object) WITHOUT dropping to the JSON panel. The
//    mutator only changes how many inputs a block exposes; the codec serialization is unchanged
//    (array: extraState.items length; object: extraState.keys read from the editable KEY fields), so
//    a mutated structure round-trips identically to a JSON-authored one (FR-124/126).

import * as Blockly from 'blockly/core';

type Json = unknown;

/**
 * Custom field holding an arbitrary JSON scalar (string/number/boolean/null) for transon_literal.
 * Editable (FR-015): the inline text editor parses input to a typed scalar so the codec keeps type
 * fidelity. The SERIALIZED value is always the typed scalar (saveState/loadState), independent of
 * the editor's working text — so `fields.VALUE` round-trips a number/boolean/null, not a string.
 */
class FieldTransonScalar extends Blockly.FieldTextInput {
  private typed_: Json;

  constructor(value?: Json) {
    super(FieldTransonScalar.display(value));
    this.typed_ = value === undefined ? null : value;
    this.SERIALIZABLE = true;
  }

  static override fromJson(options: Record<string, unknown>): FieldTransonScalar {
    return new FieldTransonScalar('value' in options ? (options['value'] as Json) : null);
  }

  /** Display/edit text for a typed value: a string shows raw; everything else as JSON. */
  static display(v: Json): string {
    return typeof v === 'string' ? v : JSON.stringify(v ?? null);
  }

  /** Parse editor text to a typed scalar: valid JSON scalar → that scalar; bare text → string. */
  static parse(text: string): Json {
    const t = text.trim();
    if (t === '') return '';
    try {
      const v: unknown = JSON.parse(t);
      if (v === null || ['number', 'boolean', 'string'].includes(typeof v)) return v as Json;
    } catch {
      /* not JSON → treat as a bare string */
    }
    return text;
  }

  // Keep the typed value in sync as the editor commits text.
  protected override doValueUpdate_(newValue: string): void {
    super.doValueUpdate_(newValue);
    this.typed_ = FieldTransonScalar.parse(newValue);
  }

  // Serialize/deserialize the TYPED scalar (codec fidelity), not the display string.
  override saveState(): Json {
    return this.typed_;
  }
  override loadState(state: Json): void {
    // setValue() runs doValueUpdate_(), which re-parses the display text and would coerce a
    // numeric-looking STRING ("0", "12") to a number. Set the authoritative typed value AFTER, so a
    // loaded scalar keeps its exact type (round-trip fidelity); only an explicit user edit re-types.
    this.setValue(FieldTransonScalar.display(state));
    this.typed_ = state;
  }

  override getText(): string {
    return FieldTransonScalar.display(this.typed_);
  }
}

/**
 * Generic curated-dropdown field (FR-130, §13.6): a `Blockly.FieldDropdown` whose menu may show
 * only a CURATED subset of labelled entries (display) while accepting every metadata-valid token
 * (an "accept set" = the menu's own values ∪ an explicit `accept` list). Rule-agnostic: it never
 * compares against a rule/param name — the menu/accept lists are supplied per block instance by
 * the projected block definition (G_palette), driven by presentation data, not by this class.
 *
 * Curation is display-only (AD-004, §21.12): a token in `accept` but not in the menu (an "alias")
 * must LOAD without throwing, DISPLAY its raw token verbatim (never blank), and round-trip
 * verbatim through workspace serialization — it is never rewritten to a curated/canonical
 * spelling. `Blockly.FieldDropdown`'s default validator (`doClassValidation_`) rejects any value
 * not literally present in the menu array, and its `getText_` returns null for a value with no
 * matching menu entry — both are overridden minimally below to honor the accept set.
 */
class FieldTransonDropdown extends Blockly.FieldDropdown {
  // Not initialized until AFTER `super()` returns — `Blockly.FieldDropdown`'s own constructor
  // calls `setOptions()` → `setValue()` → `doClassValidation_()` synchronously as part of
  // `super(menu)` (it selects the first menu option as the initial value), i.e. BEFORE this
  // subclass's constructor body runs. `doClassValidation_` below tolerates that pre-init window
  // (undefined `accept_`) by simply deferring to `super.doClassValidation_`, which already
  // accepts the first menu option being set on itself.
  private accept_: Set<string> | undefined;

  constructor(menu: Blockly.MenuOption[], accept?: string[]) {
    super(menu);
    this.accept_ = new Set([...menu.map((m) => m[1]), ...(accept ?? [])]);
  }

  static override fromJson(options: Record<string, unknown>): FieldTransonDropdown {
    return new FieldTransonDropdown(
      options['options'] as Blockly.MenuOption[],
      options['accept'] as string[] | undefined,
    );
  }

  // A token in the accept set (menu value OR alias) is valid verbatim — even when it has no menu
  // entry. Anything else defers to FieldDropdown's own validation (rejects unknown tokens). The
  // two overload signatures mirror `Blockly.FieldDropdown.doClassValidation_` exactly (required
  // by TS's override-compatibility check against the base class's overloaded method).
  protected override doClassValidation_(newValue: string): string | null | undefined;
  protected override doClassValidation_(newValue?: string): string | null;
  protected override doClassValidation_(newValue?: string): string | null | undefined {
    if (newValue !== undefined && newValue !== null && this.accept_?.has(newValue)) return newValue;
    return super.doClassValidation_(newValue);
  }

  // FieldDropdown tracks the displayed text via a `selectedOption` cache that its own
  // `doValueUpdate_` only refreshes when the new value matches a MENU entry — so for an alias
  // value (accepted but absent from the menu) `selectedOption` is left stale (whatever was
  // selected before, e.g. the constructor's first-option default), and the inherited `getText_`
  // would silently show that stale curated label instead of the alias. Show the raw value
  // whenever it has no menu entry at all — truthful and never blank (§13.6, FR-130) — and defer
  // to the inherited (curated-label) behavior only when the value genuinely IS a menu option.
  protected override getText_(): string | null {
    const value = this.getValue();
    const isMenuValue = value !== null && this.getOptions(true).some((opt) => opt[1] === value);
    if (isMenuValue) return super.getText_();
    return value === null ? null : String(value);
  }
}

// ---- dynamic-arity structural blocks: rebuild inputs from extraState + on-canvas +/- mutator ----

type DynamicBlock = Blockly.Block & {
  itemCount_?: number;
  fieldCount_?: number;
  rawState_?: unknown;
  rebuildArray_?: () => void;
  rebuildObject_?: (keys?: unknown[]) => void;
  addItem_?: () => void;
  removeItem_?: () => void;
  addField_?: () => void;
  removeField_?: () => void;
};

/** Field names of the on-canvas +/- mutator buttons (UI-only: FieldImage is non-serializable, so
 *  they can never enter the workspace serialization). Named so the append is idempotent across
 *  the mutator helper re-entering on loadExtraState. */
const PLUS_FIELD = 'TRANSON_PLUS';
const MINUS_FIELD = 'TRANSON_MINUS';

/** Inline +/- buttons as data-URI SVGs (no external assets, no btoa — URL-encoded). The two
 *  15×15 SQUARE buttons form one segmented control — red − on the left, green + on the right,
 *  joined with NO gap (the renderer's CompactRenderInfo returns 0 in-row spacing between adjacent
 *  image fields), outer corners rounded, inner edge flat. SIZE is 15px (not 16): Blockly's
 *  FieldImage adds a private 1px Y_PADDING (field_image.ts), so a 15px image yields a 16px field
 *  row — a GRID_UNIT multiple (NFR-050c); at 16px the row measured 17px and propagated an odd
 *  height into every ancestor of an array/object block. Symbols are drawn as white RECTS (crisp
 *  at any zoom, no font dependency); each button carries its symbol, so meaning never rests on
 *  colour alone (NFR-045). Display-only presentation, same FieldImage primitive (NFR-046). */
const GLYPH_SIZE = 15;
/** One square segment. `side: 'left'` rounds the outer left corners (the −), `'right'` the outer
 *  right corners (the +); the shared inner edge stays flat so the pair reads as one control. */
function segmentIcon(side: 'left' | 'right', fill: string, symbol: string): string {
  const s = GLYPH_SIZE;
  const r = 3.5;
  const path =
    side === 'left'
      ? `M ${r} 0 H ${s} V ${s} H ${r} A ${r} ${r} 0 0 1 0 ${s - r} V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`
      : `M 0 0 H ${s - r} A ${r} ${r} 0 0 1 ${s} ${r} V ${s - r} A ${r} ${r} 0 0 1 ${s - r} ${s} H 0 Z`;
  return (
    'data:image/svg+xml,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}">` +
        `<path d="${path}" fill="${fill}"/>${symbol}</svg>`,
    )
  );
}
// symbols centered in the 15×15 square: bars 9 long, 3 thick (white, bold, symmetrical)
const H_BAR = `<rect x="3" y="6" width="9" height="3" rx="1" fill="#ffffff"/>`;
const V_BAR = `<rect x="6" y="3" width="3" height="9" rx="1" fill="#ffffff"/>`;
const MINUS_ICON = segmentIcon('left', '#c9564c', H_BAR); // red −, left segment
const PLUS_ICON = segmentIcon('right', '#54a957', H_BAR + V_BAR); // green +, right segment

/** Reconcile the `<prefix>{0..count-1}` value inputs to exactly `count`, PRESERVING every existing
 *  input (and its connected child) and touching only the tail — remove the surplus, append the
 *  shortfall via `append`. A destructive remove-all + re-add rebuild would detach every child; that
 *  is invisible on the primary canvas (the +/- buttons never rebuild — addItem_/removeItem_ touch
 *  one tail input) but the FR-133 minimap's stock plugin mirrors each mutation BlockChange by
 *  REPLAYING loadExtraState → the rebuild onto its mirror block, orphaning the mirrored children
 *  (and it would likewise corrupt an on-canvas mutation undo/redo, which replays the same event). */
function reconcileValueInputs(
  block: Blockly.Block,
  prefix: string,
  count: number,
  append: (i: number) => void,
): void {
  let existing = 0;
  while (block.getInput(`${prefix}${existing}`)) existing++;
  for (let i = count; i < existing; i++) block.removeInput(`${prefix}${i}`);
  for (let i = existing; i < count; i++) append(i);
}

/** Run a +/- shape change wrapped in a mutation BlockChange event. appendValueInput/removeInput
 *  fire no Blockly events on their own, so without this the on-canvas mutations would be invisible
 *  to undo/redo and to workspace change listeners (the workspace→JSON sync). */
function withMutationEvent(block: DynamicBlock, mutate: () => void): void {
  const save = (): string => JSON.stringify(block.saveExtraState?.() ?? null);
  const oldState = save();
  mutate();
  Blockly.Events.fire(new Blockly.Events.BlockChange(block, 'mutation', null, oldState, save()));
}

/** Append the +/- buttons once, INLINE on the title row (run from the mutator helper at block
 *  init, for fresh + loaded blocks alike) — the blockly-samples plus-minus idiom, and one full row
 *  denser per array/object block (NFR-049) than the previous dedicated controls row. The title
 *  row is the implicit dummy input Blockly creates for the structural def's `message0` text; the
 *  fallback append covers a def with no message (defensive — no current structural def hits it).
 *  The buttons call the block's add/remove methods. */
function appendControls(block: DynamicBlock, add: () => void, remove: () => void): void {
  // Palette (flyout) blocks get no +/- controls: mutating a palette block is meaningless (the
  // canvas copy is a fresh block), and a grown palette block overlaps its flyout neighbours. The
  // §12.6 flat palette shows the pristine shape; the controls appear on the dropped canvas copy.
  if (block.isInFlyout) return;
  if (block.getField(PLUS_FIELD)) return;
  const title = block.inputList[0] ?? block.appendDummyInput();
  // segmented-control order: red − on the left, green + on the right
  title
    .appendField(
      new Blockly.FieldImage(MINUS_ICON, GLYPH_SIZE, GLYPH_SIZE, '−', () => remove()),
      MINUS_FIELD,
    )
    .appendField(
      new Blockly.FieldImage(PLUS_ICON, GLYPH_SIZE, GLYPH_SIZE, '+', () => add()),
      PLUS_FIELD,
    );
}

/** transon_array: ITEM{n} value inputs; count = extraState.items.length. Add/remove at the END so
 *  existing item connections are preserved (no full rebuild). */
const ARRAY_MUTATOR = {
  itemCount_: 0,
  saveExtraState(this: DynamicBlock): { items: number[] } {
    return { items: Array.from({ length: this.itemCount_ ?? 0 }, (_, i) => i) };
  },
  loadExtraState(this: DynamicBlock, state: { items?: unknown[] }): void {
    this.itemCount_ = Array.isArray(state.items) ? state.items.length : 0;
    (this.rebuildArray_ as () => void)();
  },
  rebuildArray_(this: DynamicBlock): void {
    reconcileValueInputs(this, 'ITEM', this.itemCount_ ?? 0, (i) => this.appendValueInput(`ITEM${i}`));
  },
  addItem_(this: DynamicBlock): void {
    withMutationEvent(this, () => {
      this.appendValueInput(`ITEM${this.itemCount_ ?? 0}`);
      this.itemCount_ = (this.itemCount_ ?? 0) + 1;
    });
  },
  removeItem_(this: DynamicBlock): void {
    if ((this.itemCount_ ?? 0) > 0) {
      withMutationEvent(this, () => {
        this.itemCount_ = (this.itemCount_ ?? 0) - 1;
        this.removeInput(`ITEM${this.itemCount_}`);
      });
    }
  },
};
function arrayHelper(this: DynamicBlock): void {
  if (this.itemCount_ === undefined) this.itemCount_ = 0;
  appendControls(this, () => this.addItem_!(), () => this.removeItem_!());
}

/** transon_object_literal: VALUE{n} value inputs each labelled by an EDITABLE KEY{n} field. The
 *  decoder reads keys from extraState.keys (§codegen), which saveExtraState collects from the live
 *  KEY fields — so editing/adding keys on canvas round-trips without changing the codec contract. */
const OBJECT_MUTATOR = {
  fieldCount_: 0,
  saveExtraState(this: DynamicBlock): { keys: unknown[] } {
    const keys: unknown[] = [];
    for (let i = 0; i < (this.fieldCount_ ?? 0); i++) keys.push(this.getFieldValue(`KEY${i}`));
    return { keys };
  },
  loadExtraState(this: DynamicBlock, state: { keys?: unknown[] }): void {
    const keys = Array.isArray(state.keys) ? state.keys : [];
    this.fieldCount_ = keys.length;
    (this.rebuildObject_ as (keys?: unknown[]) => void)(keys);
  },
  rebuildObject_(this: DynamicBlock, keys?: unknown[]): void {
    const k = Array.isArray(keys) ? keys : [];
    reconcileValueInputs(this, 'VALUE', this.fieldCount_ ?? 0, (i) =>
      this.appendValueInput(`VALUE${i}`).appendField(
        new Blockly.FieldTextInput(String(k[i] ?? 'key')),
        `KEY${i}`,
      ),
    );
    // Refresh the labels of the PRESERVED inputs to the loaded keys (setValue is a no-op when
    // unchanged, so the common tail-only add/remove replay fires nothing on the kept fields).
    for (let i = 0; i < (this.fieldCount_ ?? 0); i++) {
      if (k[i] !== undefined) this.getField(`KEY${i}`)?.setValue(String(k[i] ?? ''));
    }
  },
  addField_(this: DynamicBlock): void {
    withMutationEvent(this, () => {
      const i = this.fieldCount_ ?? 0;
      this.appendValueInput(`VALUE${i}`).appendField(new Blockly.FieldTextInput('key'), `KEY${i}`);
      this.fieldCount_ = i + 1;
    });
  },
  removeField_(this: DynamicBlock): void {
    if ((this.fieldCount_ ?? 0) > 0) {
      withMutationEvent(this, () => {
        this.fieldCount_ = (this.fieldCount_ ?? 0) - 1;
        this.removeInput(`VALUE${this.fieldCount_}`);
      });
    }
  },
};
function objectHelper(this: DynamicBlock): void {
  if (this.fieldCount_ === undefined) this.fieldCount_ = 0;
  appendControls(this, () => this.addField_!(), () => this.removeField_!());
}

/** transon_unsupported: preserve the raw out-of-surface payload verbatim; edit-blocked (§13.11). */
const UNSUPPORTED_MUTATOR = {
  rawState_: null as unknown,
  saveExtraState(this: DynamicBlock): { raw: unknown } {
    return { raw: this.rawState_ ?? null };
  },
  loadExtraState(this: DynamicBlock, state: { raw?: unknown }): void {
    this.rawState_ = state.raw ?? null;
    this.setEditable(false);
  },
};

let registered = false;

// Register, ignoring "already registered" if the singleton Blockly module was touched elsewhere.
function ignoreDuplicate(fn: () => void): void {
  try {
    fn();
  } catch (e) {
    if (!/already|registered/i.test(String((e as Error)?.message))) throw e;
  }
}

/**
 * Register the finite behavior runtime (the editable scalar field + the generic curated dropdown
 * field + the three structural mutators, each with its on-canvas +/- controls via the mutator
 * helper fn). Idempotent. Must run before block definitions that reference them are loaded.
 */
export function registerTransonRuntime(): void {
  if (registered) return;
  registered = true;
  ignoreDuplicate(() => Blockly.fieldRegistry.register('field_transon_scalar', FieldTransonScalar));
  ignoreDuplicate(() => Blockly.fieldRegistry.register('field_transon_dropdown', FieldTransonDropdown));
  ignoreDuplicate(() => Blockly.Extensions.registerMutator('transon_array_mutator', ARRAY_MUTATOR, arrayHelper));
  ignoreDuplicate(() => Blockly.Extensions.registerMutator('transon_object_mutator', OBJECT_MUTATOR, objectHelper));
  ignoreDuplicate(() => Blockly.Extensions.registerMutator('transon_unsupported_mutator', UNSUPPORTED_MUTATOR));
}

/** The fixed set of interaction primitives this runtime registers (NFR-046 size invariant). */
export const BEHAVIOR_PRIMITIVES = [
  'field_transon_scalar',
  'field_transon_dropdown',
  'transon_array_mutator',
  'transon_object_mutator',
  'transon_unsupported_mutator',
] as const;
