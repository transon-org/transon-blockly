import { describe, it, expect } from 'vitest';
import { CodecError } from '@transon/editor-core';
import { codecErrorCode } from '../src/session/errors.js';

// §16.4 + AD-035/RFC-004 (AC-042 companion): depth/recursion limits during codec execution are
// runtime LIMITS, mapped to `runtime_transformation` — never `import_unsupported` — whichever
// limit trips (metadata-contract §6.5). The engine-guard path ("depth limit") was locked at M5 D5
// (fix `1cf0be6`); the raise of CODEC_MAX_INCLUDE_DEPTH to 55 adds the second path: a pathological
// rule-per-level document can overflow the host stack inside the engine call, and the caught raw
// overflow (Python RecursionError via the EngineProvider boundary) must land on the same code.
describe('codecErrorCode — §16.4 runtime-limit mapping (AD-035)', () => {
  it('engine include depth-limit guard → runtime_transformation (both phases)', () => {
    const err = new CodecError('include depth limit (55) exceeded: enc → enc', 'TransformationError');
    expect(codecErrorCode(err, 'reverse')).toBe('runtime_transformation');
    expect(codecErrorCode(err, 'forward')).toBe('runtime_transformation');
  });

  it('caught host recursion overflow (message) → runtime_transformation, not import_unsupported', () => {
    const err = new CodecError('maximum recursion depth exceeded while calling a Python object');
    expect(codecErrorCode(err, 'reverse')).toBe('runtime_transformation');
    expect(codecErrorCode(err, 'forward')).toBe('runtime_transformation');
  });

  it('caught host recursion overflow (errorType RecursionError) → runtime_transformation', () => {
    const err = new CodecError('stack exhausted', 'RecursionError');
    expect(codecErrorCode(err, 'reverse')).toBe('runtime_transformation');
  });

  it('include resolution failures keep precedence over the limit mapping', () => {
    const err = new CodecError('include not resolvable: enc__attr', 'TransformationError');
    expect(codecErrorCode(err, 'reverse')).toBe('include_loader');
  });

  it('other reverse-phase codec failures stay import_unsupported (§15.7 surface gate)', () => {
    const err = new CodecError('some structural mismatch', 'TransformationError');
    expect(codecErrorCode(err, 'reverse')).toBe('import_unsupported');
    expect(codecErrorCode(err, 'forward')).toBe('editor_internal');
  });
});
