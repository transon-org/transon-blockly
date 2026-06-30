// The Python glue executed inside Pyodide (ARCHITECTURE §5.9). It mirrors the proven Node
// runner.py transon API usage, but as in-process functions that cross the JS↔Python boundary as
// SERIALIZED JSON STRINGS (json.dumps ↔ JSON.parse) — never live proxies (AD-030, §5.9). It runs
// both user templates (validate/transform) and the projection codecs (via the same transform), with
// `file` writes captured and `include` resolved through a host loader (the pre-resolved `includes`
// map and/or a JS callback for dynamic resolution, §16.5/§16.6).

export const GLUE_PY = String.raw`
import json
from transon import Transformer, DefinitionError, TransformationError
try:
    from transon.metadata import get_editor_metadata
except Exception:  # pragma: no cover - older engines
    get_editor_metadata = None


def _error_fields(exc):
    if isinstance(exc, DefinitionError):
        et = "DefinitionError"
    elif isinstance(exc, TransformationError):
        et = "TransformationError"
    else:
        et = type(exc).__name__
    msg = str(exc)
    return {"error_type": et, "error_message": msg, "raw_engine_error": msg}


def transon_validate(template_json, marker):
    try:
        Transformer(json.loads(template_json), marker=marker).validate()
    except (DefinitionError, TransformationError) as exc:
        return json.dumps({"status": "ok", "valid": False, **_error_fields(exc)})
    return json.dumps({"status": "ok", "valid": True})


def _make_loader(includes, marker, js_loader):
    if not includes and js_loader is None:
        return None

    def loader(name, context=None):
        template = None
        if includes and name in includes:
            template = includes[name]
        elif js_loader is not None:
            s = js_loader(name)  # JS callback returns a JSON string or None
            if s is not None:
                template = json.loads(s)
        if template is None:
            raise TransformationError("include not resolvable: " + str(name))
        if context is not None:
            return context.transformer(template)
        return Transformer(template, marker=marker)

    return loader


def transon_transform(template_json, input_json, marker, includes_json, js_loader):
    template = json.loads(template_json)
    data = json.loads(input_json)
    includes = json.loads(includes_json) if includes_json else {}
    files_written = {}

    def file_writer(name, content):
        files_written[name] = content

    loader = _make_loader(includes, marker, js_loader)
    kwargs = {"marker": marker, "file_writer": file_writer}
    if loader is not None:
        kwargs["template_loader"] = loader
    try:
        output = Transformer(template, **kwargs).transform(data, copy_output=True)
    except (DefinitionError, TransformationError) as exc:
        return json.dumps(
            {"status": "ok", "success": False, "files_written": files_written, **_error_fields(exc)}
        )
    return json.dumps(
        {"status": "ok", "success": True, "output": output, "files_written": files_written}
    )


def transon_version():
    import transon

    version = getattr(transon, "__version__", None)
    meta = get_editor_metadata() if get_editor_metadata else {}
    return json.dumps(
        {
            "engine": str(version) if version else str(meta.get("engine_version", "unknown")),
            "metadata": str(meta.get("metadata_version", "unknown")),
        }
    )
`;
