#!/usr/bin/env python3
"""Newline-delimited JSON bridge from Node into the `transon` engine (AD-011, AD-025).

Reads one JSON request object per line from stdin and writes one JSON response object
per line to stdout. This is the test-only Node->Python EngineProvider adapter; production
embedders supply their own EngineProvider (AD-008).

Operations:
  {"op": "version"}
      -> {"engine": <engine version>, "metadata": <metadata_version>}
  {"op": "validate", "template": <json>, "marker": <str>}
      -> SPEC §9.9 ValidationResult
  {"op": "transform", "template": <json>, "input": <json>, "marker": <str>,
                      "includes": {<name>: <json>, ...}}
      -> SPEC §9.10 ExecutionResult (incl. captured `file` writes as files_written)

Engine resolution mirrors harness/scripts/check_engine_parity.py: try importing
`transon` directly (e.g. when launched with the engine venv / PYTHONPATH set), else
fall back to a sibling checkout at $TRANSON_REPO or ../../transon.
"""
import json
import os
import sys


def _ensure_engine_importable():
    try:
        import transon  # noqa: F401
        return
    except ImportError:
        pass
    here = os.path.dirname(os.path.abspath(__file__))
    # editor repo root is three levels up: test/engine-node-adapter/src -> repo
    repo_root = os.path.abspath(os.path.join(here, "..", "..", ".."))
    candidates = [
        os.environ.get("TRANSON_REPO"),
        os.path.join(os.path.dirname(repo_root), "transon"),
    ]
    for candidate in candidates:
        if candidate and os.path.exists(
            os.path.join(candidate, "transon", "__init__.py")
        ):
            sys.path.insert(0, candidate)
            try:
                import transon  # noqa: F401
                return
            except ImportError:
                continue
    raise ImportError(
        "Could not import `transon`. Set TRANSON_PYTHON to the engine venv python or "
        "TRANSON_REPO to a transon checkout."
    )


_ensure_engine_importable()

from transon import (  # noqa: E402
    Transformer,
    DefinitionError,
    TransformationError,
)
from transon.metadata import get_editor_metadata  # noqa: E402


def _engine_version():
    # Prefer transon.__version__ if a future engine exposes it; otherwise derive from
    # the editor-metadata export's engine_version. Fall back to the metadata_version's
    # neighbour only as a last resort.
    import transon

    version = getattr(transon, "__version__", None)
    if version:
        return str(version)
    meta = get_editor_metadata()
    ev = meta.get("engine_version")
    return str(ev) if ev is not None else "unknown"


def _error_fields(exc):
    """Map an engine exception to the SPEC §9.9/§9.10 error fields."""
    if isinstance(exc, DefinitionError):
        error_type = "DefinitionError"
    elif isinstance(exc, TransformationError):
        error_type = "TransformationError"
    else:
        error_type = type(exc).__name__
    message = str(exc)
    return {
        "error_type": error_type,
        "error_message": message,
        "raw_engine_error": message,
    }


def _op_version(_req):
    meta = get_editor_metadata()
    return {
        "engine": _engine_version(),
        "metadata": str(meta["metadata_version"]),
    }


def _op_validate(req):
    template = req["template"]
    marker = req.get("marker", "$")
    try:
        Transformer(template, marker=marker).validate()
    except (DefinitionError, TransformationError) as exc:
        return {"status": "ok", "valid": False, **_error_fields(exc)}
    return {"status": "ok", "valid": True}


def _make_template_loader(includes, marker):
    """Wrap a name->json include map as an engine template_loader (AD-010).

    The v0.1.3 engine always calls the loader as ``loader(name, context=IncludeContext)``
    (transon rules.py: `include` -> `template_loader(name, context=...)`). The loader must
    build the sub-Transformer via ``context.transformer(...)`` so the parent's loader,
    marker, and `max_include_depth` guard are inherited — that is what lets the codec's
    self-`include` recurse and terminate cleanly at the depth limit instead of looping
    (metadata-contract §6.5). At the top level there is no context yet, so fall back to a
    plain Transformer carrying the active marker.
    """
    if not includes:
        return None

    def loader(name, context=None):
        if name not in includes:
            raise TransformationError(f"include not resolvable: {name}")
        template = includes[name]
        if context is not None:
            return context.transformer(template)
        return Transformer(template, marker=marker)

    return loader


def _op_transform(req):
    template = req["template"]
    data = req.get("input")
    marker = req.get("marker", "$")
    includes = req.get("includes") or {}

    files_written = {}

    def file_writer(name, content):
        files_written[name] = content

    template_loader = _make_template_loader(includes, marker)

    kwargs = {"marker": marker, "file_writer": file_writer}
    if template_loader is not None:
        kwargs["template_loader"] = template_loader

    try:
        transformer = Transformer(template, **kwargs)
        output = transformer.transform(data, copy_output=True)
    except (DefinitionError, TransformationError) as exc:
        return {
            "status": "ok",
            "success": False,
            "files_written": files_written,
            **_error_fields(exc),
        }
    return {
        "status": "ok",
        "success": True,
        "output": output,
        "files_written": files_written,
    }


_OPS = {
    "version": _op_version,
    "validate": _op_validate,
    "transform": _op_transform,
}


def _handle(req):
    op = req.get("op")
    handler = _OPS.get(op)
    if handler is None:
        return {"status": "error", "error_message": f"unknown op: {op!r}"}
    try:
        return handler(req)
    except Exception as exc:  # pragma: no cover - defensive bridge guard
        return {
            "status": "error",
            "error_message": str(exc),
            "error_type": type(exc).__name__,
        }


def main():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
        except json.JSONDecodeError as exc:
            response = {"status": "error", "error_message": f"bad json: {exc}"}
        else:
            response = _handle(req)
        sys.stdout.write(json.dumps(response) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
