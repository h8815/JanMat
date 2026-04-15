import os
from PIL import Image

def convert_to_webp(folder_path):
    print(f"Scanning {folder_path} for images...")
    saved_bytes = 0
    for filename in os.listdir(folder_path):
        if filename.endswith(".png") or filename.endswith(".jpg"):
            filepath = os.path.join(folder_path, filename)
            original_size = os.path.getsize(filepath)
            if original_size < 100 * 1024:
                continue # Skip small files under 100KB

            webp_filename = filename.rsplit('.', 1)[0] + '.webp'
            webp_filepath = os.path.join(folder_path, webp_filename)
            
            try:
                img = Image.open(filepath)
                # Convert RGBA to RGB for webp if keeping it light, but webp supports RGBA
                img.save(webp_filepath, 'webp', optimize=True, quality=80)
                new_size = os.path.getsize(webp_filepath)
                saved = original_size - new_size
                saved_bytes += saved
                print(f"Compressed {filename}: {original_size/1024/1024:.2f}MB -> {new_size/1024/1024:.2f}MB")
                
                # We can optionally delete the original, but let's keep it safe for now and just use webp
            except Exception as e:
                print(f"Failed to convert {filename}: {e}")
                
    print(f"Total space saved: {saved_bytes/1024/1024:.2f} MB")

if __name__ == "__main__":
    import sys
    convert_to_webp(sys.argv[1])
