import json

def to_ts_object(d, indent=0):
    lines = []
    pad = "  " * indent
    lines.append("{")
    for k, v in d.items():
        key_str = f'"{k}"' if " " in k or "-" in k else k
        if isinstance(v, dict):
            inner = to_ts_object(v, indent + 1)
            lines.append(f"{pad}  {key_str}: {inner},")
        elif isinstance(v, str):
            escaped = v.replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n')
            lines.append(f'{pad}  {key_str}: "{escaped}",')
    lines.append(f"{pad}}}")
    return "\n".join(lines)

print("Helper ready")
