"""Read-only PyInstaller CArchive inventory; never executes embedded Python code."""
import hashlib, json, marshal, pathlib, re, struct, zlib

root = pathlib.Path(__file__).resolve().parents[2]
out = pathlib.Path(__file__).resolve().parent
exe = root / 'vendor/yt-dlp.exe'
data = exe.read_bytes()
magic = b'MEI\x0c\x0b\x0a\x0b\x0e'
cookie = data.rfind(magic)
assert cookie >= 0
_, length, toc_offset, toc_length, python_version, python_lib = struct.unpack('!8sIIII64s', data[cookie:cookie+88])
start = cookie + 88 - length
pos, end = start + toc_offset, start + toc_offset + toc_length
entries, metadata, modules = [], [], []
while pos < end:
    size, offset, stored, raw_size, compressed, typecode = struct.unpack('!IIIIBc', data[pos:pos+18])
    assert size >= 18
    name = data[pos+18:pos+size].rstrip(b'\x00').decode('utf8')
    entry = dict(name=name, storedBytes=stored, rawBytes=raw_size, compressed=bool(compressed), type=typecode.decode())
    payload = data[start+offset:start+offset+stored]
    if compressed: payload = zlib.decompress(payload)
    assert len(payload) == raw_size
    entry['sha256'] = hashlib.sha256(payload).hexdigest()
    if name.endswith(('.dll','.pyd')):
        target=root/'test-output/source-taskbar-round2/embedded-native'/pathlib.Path(name.replace('\\','/'))
        assert target.resolve().is_relative_to((root/'test-output/source-taskbar-round2/embedded-native').resolve())
        target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(payload)
    entries.append(entry)
    if name == 'PYZ.pyz':
        assert payload[:4] == b'PYZ\x00'
        toc = marshal.loads(payload[struct.unpack('!I',payload[8:12])[0]:])
        modules = [item[0] for item in toc] if isinstance(toc,list) else list(toc)
    if name.endswith(('/METADATA', '\\METADATA', '/WHEEL', '\\WHEEL')) or name in ('THIRD_PARTY_LICENSES.txt',):
        assert len(payload) == raw_size
        text = payload.decode('utf8', errors='replace')
        target = out / 'bundle-metadata' / pathlib.Path(name.replace('\\', '/'))
        assert target.resolve().is_relative_to((out/'bundle-metadata').resolve())
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(payload)
        metadata.append(dict(name=name, sha256=hashlib.sha256(payload).hexdigest(), fields={k:v.strip() for k,v in re.findall(r'^(Name|Version|License|License-Expression|Home-page): (.*)$', text, re.M)}))
    pos += size
assert pos == end
result = dict(binary=str(exe), sha256=hashlib.sha256(data).hexdigest(), cookieOffset=cookie,
              pythonVersion=python_version, pythonLibrary=python_lib.rstrip(b'\x00').decode(),
              entries=entries, metadata=metadata, modules=modules,
              execution='none; compressed metadata and PYZ name/address TOC only; no code objects loaded')
(out/'yt-dlp-carchive.json').write_text(json.dumps(result, indent=2), encoding='utf8')
print(json.dumps(dict(pythonVersion=python_version, pythonLibrary=result['pythonLibrary'], entries=len(entries), metadata=metadata), indent=2))
