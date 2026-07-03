// The host boundary types the editor consumes (ARCHITECTURE §5.2, SPEC §10.4). The editor defines
// these and the embedding host implements `engine`; everything else is optional configuration.

import type { EditorMetadata, EngineProvider, Json } from '@transon/editor-core';
import type { ToolboxCategoryConfig } from '../blockly/toolbox.js';

/**
 * Theming hooks (FR-108/FR-128): scoped CSS custom properties applied to the editor's light-DOM
 * root (AD-018). Keys are `--transon-*` custom properties theming editor **chrome only** (panels,
 * toolbar, typography); non-`--transon-*` keys are ignored. Block/category colours stay data-driven
 * from the committed presentation data (FR-127) and are not theme-overridable in v1.
 */
export type TransonTheme = Record<string, string>;

/** A documentation/playground example (SPEC §9.8). Host-supplied corpus for the Examples panel. */
export interface ExampleCase {
  name: string;
  /** Human description. */
  doc?: string;
  tags?: string[];
  /** The Transon template to load. */
  template: Json;
  /** Sample input for the example, when it has one. */
  data?: Json;
  /** Expected output, for actual-vs-expected display (M5). */
  result?: Json;
  rule?: string;
  param?: string;
  /**
   * Curated-tier membership, resolved from the engine `docs.worked_examples`/`docs.recipes`
   * name-reference lists (metadata-contract §2.7 — the engine-owned join; never re-derived from
   * tag conventions). Unset for reference examples; a host corpus may set it the same way.
   */
  tier?: 'worked-example' | 'recipe';
}

/**
 * What an embedder supplies (ARCHITECTURE §5.2). `engine` is the one runtime dependency (AD-008);
 * omit it and validate/run/projection are gated (§10.4). `metadata` defaults to the committed
 * snapshot the codec/palette/toolbox were generated from (AD-012/AD-030) — the runtime
 * metadata-source override is future work, so embedders normally leave it unset.
 */
export interface TransonEditorHost {
  engine?: EngineProvider;
  marker?: string;
  examples?: ExampleCase[];
  metadata?: EditorMetadata;
  /** Chrome-only CSS-var theming hooks (FR-108/FR-128). */
  theme?: TransonTheme;
  /** Hide/reorder the fixed §12.4 toolbox categories (FR-109). */
  categories?: ToolboxCategoryConfig;
  /** Dynamic include resolver (AD-010, §16.6) — for an in-process host that can call back. */
  includeLoader?(name: string): Json | undefined;
  /** Pre-resolved `name → fragment` includes (§16.6) — for a stateless host (the Node bridge). */
  includes?: Record<string, Json>;
}
