// The host boundary types the editor consumes (ARCHITECTURE §5.2, SPEC §10.4). The editor defines
// these and the embedding host implements `engine`; everything else is optional configuration.

import type { EditorMetadata, EngineProvider, Json } from '@transon/editor-core';

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
  theme?: unknown;
}
