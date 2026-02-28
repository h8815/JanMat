import os
import re
import json

src_dir = r"d:\minor-project\UI2\janmat\frontend\src"
i18n_file = os.path.join(src_dir, "i18n.js")

# Regex to find t('key') or t("key") or t("key", defaults)
t_pattern = re.compile(r"t\(\s*['\"]([^'\"]+)['\"]\s*(?:,|/[^)]*)?\)")

found_keys = set()

# Scan all .js and .jsx files
for root, _, files in os.walk(src_dir):
    for f in files:
        if f.endswith('.js') or f.endswith('.jsx'):
            with open(os.path.join(root, f), 'r', encoding='utf-8') as file:
                content = file.read()
                matches = t_pattern.findall(content)
                found_keys.update(matches)

# Extract existing keys from i18n.js
defined_keys = set()
with open(i18n_file, 'r', encoding='utf-8') as f:
    content = f.read()
    # Simple regex to find keys in objects: 'key': 'value'
    # It might be easier to just look for literal definitions
    dict_pattern = re.compile(r"^\s*['\"]?([^'\":\n]+)['\"]?\s*:\s*['\"].*?,?$", re.MULTILINE)
    defined_keys.update(dict_pattern.findall(content))

missing_keys = found_keys - defined_keys

print(f"Total keys found in source: {len(found_keys)}")
print(f"Missing keys from i18n.js: {len(missing_keys)}")
for k in sorted(missing_keys):
    print(k)

