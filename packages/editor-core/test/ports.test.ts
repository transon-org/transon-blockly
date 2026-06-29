// Type-level proof that a host can implement the EngineProvider port, and that the
// result shapes carry the SPEC §9.9 / §9.10 fields.
//   AD-008  — engine is a host-provided port; the editor only defines the type.
//   FR-116/FR-119 covered by the adapter tests; here we lock the port surface.
import { describe, it, expect, expectTypeOf } from 'vitest';
import type {
  EngineProvider,
  ValidationResult,
  ExecutionResult,
  Json,
} from '../src/index.js';

// AD-008: a mock EngineProvider must compile against the port. If the port surface
// changes incompatibly, this fails to typecheck (caught by `tsc --noEmit`).
const mock: EngineProvider = {
  status: 'idle',
  async init() {
    /* no-op */
  },
  async validate(_template: Json, _o: { marker: string }): Promise<ValidationResult> {
    return { status: 'ok', valid: true };
  },
  async transform(
    _template: Json,
    _input: Json,
    _o: { marker: string; includeLoader?(name: string): Json | undefined },
  ): Promise<ExecutionResult> {
    return { status: 'ok', success: true, output: null };
  },
  async version(): Promise<{ engine: string; metadata: string }> {
    return { engine: '0.0.0', metadata: '2.0' };
  },
  dispose() {
    /* no-op */
  },
};

describe('EngineProvider port (AD-008)', () => {
  it('a mock host implementation satisfies the port type', () => {
    // The value above already type-checks; assert it is wired as expected at runtime.
    expectTypeOf(mock).toMatchTypeOf<EngineProvider>();
    expect(mock.status).toBe('idle');
  });

  it('ValidationResult carries the SPEC §9.9 fields', () => {
    // §9.9: status, valid, error_type, error_message, template_path, block_id, raw_engine_error.
    expectTypeOf<ValidationResult>().toHaveProperty('status');
    expectTypeOf<ValidationResult>().toHaveProperty('valid');
    expectTypeOf<ValidationResult>().toHaveProperty('error_type');
    expectTypeOf<ValidationResult>().toHaveProperty('error_message');
    expectTypeOf<ValidationResult>().toHaveProperty('template_path');
    expectTypeOf<ValidationResult>().toHaveProperty('block_id');
    expectTypeOf<ValidationResult>().toHaveProperty('raw_engine_error');
    expectTypeOf<ValidationResult['valid']>().toEqualTypeOf<boolean>();
  });

  it('ExecutionResult carries the SPEC §9.10 fields (camelCase filesWritten)', () => {
    // §9.10 adds output, success, files_written; the TS port uses camelCase filesWritten
    // (ARCHITECTURE §5.2 naming) — the adapter maps snake→camel.
    expectTypeOf<ExecutionResult>().toHaveProperty('status');
    expectTypeOf<ExecutionResult>().toHaveProperty('success');
    expectTypeOf<ExecutionResult>().toHaveProperty('output');
    expectTypeOf<ExecutionResult>().toHaveProperty('filesWritten');
    expectTypeOf<ExecutionResult>().toHaveProperty('error_type');
    expectTypeOf<ExecutionResult>().toHaveProperty('raw_engine_error');
    expectTypeOf<ExecutionResult['success']>().toEqualTypeOf<boolean>();
  });
});
