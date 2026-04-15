import os

d = r'd:\minor-project\UI2\janmat\frontend\src'
replacements = [
    ('indiaGate.png', 'indiaGate.webp'),
    ('votebg.png', 'votebg.webp'),
    ('janmat.png', 'janmat.webp'),
    ('ashoka.png', 'ashoka.webp'),
    ('ashoka-black.png', 'ashoka-black.webp'),
    ('mail.png', 'mail.webp'),
]

for root, _, files in os.walk(d):
    for f in files:
        if f.endswith('.jsx') or f.endswith('.css'):
            path = os.path.join(root, f)
            with open(path, 'r', encoding='utf-8') as file:
                content = file.read()
            
            modified = False
            for old, new in replacements:
                if old in content:
                    content = content.replace(old, new)
                    modified = True
            
            if modified:
                with open(path, 'w', encoding='utf-8') as file:
                    file.write(content)
                print(f"Updated {f}")
