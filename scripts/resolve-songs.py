"""
为 src/data/song-pool.json 中的每首歌查出精确曲目 ID，输出 src/data/song-ids.json

- iTunes（香港区）：按「歌名 歌手」检索，只接受歌名一致且歌手一致的原唱版本（排除 Live / 伴奏 / 翻唱）
- Deezer：中文歌在 Deezer 上常用英文名（例如《我要夏天》= I Want Summer），所以依次尝试
    1) 歌名一致 + 歌手一致
    2) 歌名一致 + 时长与 iTunes 原唱相差 ≤ 2 秒，且括号里没有写原唱歌手名（排除翻唱）
    （不再用「歌手一致 + 时长接近」匹配英文译名：实测会把同一歌手的另一首歌误认成目标歌曲）
- 页面运行时按 ID 取最新试听链接，彻底避免模糊检索带来的同名翻唱、重复曲目

用法：python3 scripts/resolve-songs.py      （需要 pip install opencc-python-reimplemented）
进度缓存在 scripts/.resolve-cache.json，中断后重跑会跳过已完成的歌。
"""
import json, re, time, subprocess, urllib.parse, pathlib, sys
import opencc

ROOT = pathlib.Path(__file__).resolve().parent.parent
POOL = json.loads((ROOT / 'src/data/song-pool.json').read_text(encoding='utf-8'))
OUT = ROOT / 'src/data/song-ids.json'
CACHE = ROOT / 'scripts/.resolve-cache.json'
cc = opencc.OpenCC('t2s')
cache = json.loads(CACHE.read_text(encoding='utf-8')) if CACHE.exists() else {}

BAD = re.compile(r'(live|现场|現場|伴奏|instrumental|karaoke|remix|dj|demo|翻唱|cover|原唱|钢琴版|純音樂|纯音乐|铃声|片段)', re.I)


def get(url):
    for attempt in range(4):
        r = subprocess.run(['curl', '-sL', '-m', '15', url], capture_output=True, text=True)
        if r.returncode == 0 and r.stdout.strip().startswith(('{', '[')):
            return json.loads(r.stdout)
        time.sleep(6 * (attempt + 1))
    return {}


def norm(s):
    s = cc.convert(s or '').lower()
    s = re.sub(r'[\(（\[【].*?[\)）\]】]', '', s)
    s = re.sub(r'\s+-\s+.*$', '', s)
    return re.sub(r'[\s,，.。·・\'"’!！?？&、/_\-]+', '', s)


def artist_ok(cand, aliases):
    c = norm(cand)
    return any(a and (a == c or a in c or c in a) for a in aliases)


last_it = [0.0]


def itunes(path):
    wait = 3.2 - (time.time() - last_it[0])
    if wait > 0:
        time.sleep(wait)
    last_it[0] = time.time()
    return get('https://itunes.apple.com/' + path)


def resolve_itunes(t, a):
    q = urllib.parse.quote(f'{t} {a}')
    best = None
    for country in ('HK', 'TW'):
        d = itunes(f'search?term={q}&country={country}&media=music&entity=song&limit=15')
        for r in d.get('results', []):
            name = r.get('trackName', '')
            if norm(name) != norm(t) or not artist_ok(r.get('artistName', ''), [norm(a)]):
                continue
            if BAD.search(name) or BAD.search(r.get('collectionName', '')) and 'live' in r.get('collectionName', '').lower():
                continue
            if not r.get('previewUrl'):
                continue
            score = (len(name), r.get('releaseDate', '9999'))
            if best is None or score < best[0]:
                best = (score, r)
        if best:
            break
    if not best:
        return None
    r = best[1]
    return {'it': r['trackId'], 'dur': round(r.get('trackTimeMillis', 0) / 1000), 'itArtist': r.get('artistName', '')}


def resolve_deezer(t, a, info):
    aliases = [norm(a)]
    if info:
        aliases += [norm(info.get('itArtist', '')), norm(info.get('enArtist', ''))]
    dur = info.get('dur') if info else None
    queries = [f'artist:"{a}" track:"{t}"', f'{t} {a}', a]
    if info and info.get('enArtist'):
        queries.append(info['enArtist'])
    cands = {}
    for q in queries:
        d = get(f'https://api.deezer.com/search?q={urllib.parse.quote(q)}&limit=100')
        for x in d.get('data', []):
            if x.get('preview'):
                cands[x['id']] = x
        time.sleep(0.15)
    picks = []
    for x in cands.values():
        title, art, xd = x.get('title', ''), x.get('artist', {}).get('name', ''), x.get('duration', 0)
        if BAD.search(title):
            continue
        # 括号里写着原唱歌手名的，多半是翻唱，例如「温柔 (五月天)」
        paren = ''.join(re.findall(r'[\(（\[【](.*?)[\)）\]】]', title))
        if paren and any(al and al in norm(paren) for al in aliases):
            continue
        same_title = norm(title) == norm(t) or norm(x.get('title_short', '')) == norm(t)
        same_artist = artist_ok(art, aliases)
        dd = abs(xd - dur) if dur else 99
        if same_title and same_artist:
            picks.append((0, dd, x, 'A'))
        elif same_title and dd <= 2:
            picks.append((1, dd, x, 'B'))
    if not picks:
        return None
    picks.sort(key=lambda p: (p[0], p[1], len(p[2]['title'])))
    p = picks[0]
    return {'dz': p[2]['id'], 'dzTitle': p[2]['title'], 'dzArtist': p[2]['artist']['name'], 'dzMatch': p[3]}


songs = []
for group in ('city', 'weather', 'genre'):
    for lst in POOL[group].values():
        for s in lst:
            k = f"{s['t']}|{s['a']}"
            if k not in [x[0] for x in songs]:
                songs.append((k, s['t'], s['a']))

# 第一轮：iTunes
for i, (k, t, a) in enumerate(songs):
    if k in cache and 'itDone' in cache[k]:
        continue
    info = resolve_itunes(t, a) or {}
    info['itDone'] = True
    cache[k] = {**cache.get(k, {}), **info}
    CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=0), encoding='utf-8')
    print(f'[iTunes {i + 1}/{len(songs)}] {k} → {info.get("it", "未找到")}', flush=True)

# 批量查英文艺人名（美国区），供 Deezer 匹配英文译名
ids = [str(v['it']) for v in cache.values() if v.get('it') and 'enArtist' not in v]
for i in range(0, len(ids), 150):
    d = itunes(f'lookup?id={",".join(ids[i:i + 150])}&country=US')
    en = {r['trackId']: r.get('artistName', '') for r in d.get('results', []) if r.get('trackId')}
    for v in cache.values():
        if v.get('it') in en:
            v['enArtist'] = en[v['it']]
for v in cache.values():
    if v.get('it') and 'enArtist' not in v:
        v['enArtist'] = ''
CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=0), encoding='utf-8')

# 第二轮：Deezer
for i, (k, t, a) in enumerate(songs):
    if 'dzDone' in cache[k]:
        continue
    info = resolve_deezer(t, a, cache[k]) or {}
    info['dzDone'] = True
    cache[k] = {**cache[k], **info}
    CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=0), encoding='utf-8')
    print(f'[Deezer {i + 1}/{len(songs)}] {k} → {info.get("dzTitle", "未找到")} {info.get("dzMatch", "")}', flush=True)

out = {}
for k, _, _ in songs:
    v = cache[k]
    e = {}
    if v.get('it'):
        e['it'] = v['it']
    if v.get('dz'):
        e['dz'] = v['dz']
    if v.get('dur'):
        e['d'] = v['dur']
    if e:
        out[k] = e
OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
both = sum(1 for e in out.values() if 'it' in e and 'dz' in e)
print(f'\n共 {len(songs)} 首：两边都有 {both}，仅 iTunes {sum(1 for e in out.values() if "it" in e and "dz" not in e)}，'
      f'仅 Deezer {sum(1 for e in out.values() if "dz" in e and "it" not in e)}，都没有 {len(songs) - len(out)}')
