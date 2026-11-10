"""Parse EditorShortcuts.swift into the JSON the docs reference page renders.

The defaults table carries a trailing comment with the rendered shortcut
(e.g. `// ⌘B`), which is the authoritative human form — deriving it from the
raw NSEvent keyCode would mean re-implementing a US keyboard map here and
getting it subtly wrong. So the comment is parsed, and its absence is an error
rather than a silent gap.
"""
import json
import re
import sys

src, out = sys.argv[1], sys.argv[2]
text = open(src, encoding="utf-8").read()

# displayName switch: `case .bold: return "Bold"`
names = dict(
    re.findall(r'case \.(\w+):\s*return "([^"]+)"', text)
)

# The enum declaration carries `// MARK`-less section comments (`// Formatting`)
enum_block = re.search(
    r"public enum EditorAction[^{]*\{(.*?)\n\}", text, re.S
).group(1)

section, order = None, []
for line in enum_block.splitlines():
    s = line.strip()
    if s.startswith("//") and not s.startswith("///"):
        section = s.lstrip("/ ").strip()
    m = re.match(r"case (\w+)\s*=", s)
    if m:
        order.append((m.group(1), section))

# defaults table: `.bold: KeyBinding(keyCode: 11, modifiers: cmd),  // ⌘B`
keys = dict(
    re.findall(r"\.(\w+):\s*KeyBinding\([^)]*\),?\s*//\s*(\S+)", text)
)

missing = [a for a, _ in order if a not in keys]
if missing:
    sys.exit(f"✗ no default binding comment for: {', '.join(missing)}")

groups: dict[str, list] = {}
for action, sec in order:
    groups.setdefault(sec or "Other", []).append(
        {"action": action, "name": names.get(action, action), "keys": keys[action]}
    )

payload = {
    "_generated": "scripts/gen-shortcuts-json.sh from EditorShortcuts.swift — do not hand-edit",
    "count": len(order),
    "groups": [{"title": t, "shortcuts": v} for t, v in groups.items()],
}
with open(out, "w", encoding="utf-8") as f:
    json.dump(payload, f, indent=2, ensure_ascii=False)
    f.write("\n")
print(f"  {len(order)} actions in {len(groups)} groups")
