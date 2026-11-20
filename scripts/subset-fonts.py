"""
本地子集化 Noto Serif SC（SIL OFL 1.1），生成 src/assets/fonts/*.woff2
- 400 常规：GB2312 一级常用字 3755 个 + 源码中出现的全部字符 + ASCII（覆盖接口返回的歌名、城市名）
- 700 粗体：只含源码里写死的界面文字（标题、按钮、标签）
用法：python3 scripts/subset-fonts.py  （需要 fonttools、brotli，以及系统中的 NotoSerifCJK-*.ttc）
"""
import glob, os
from fontTools.ttLib import TTCollection
from fontTools import subset

SRC = {'400': '/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc',
       '700': '/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc'}

def source_chars():
    chars = set()
    for f in glob.glob('src/**/*.*', recursive=True) + ['index.html']:
        if f.endswith(('.vue', '.js', '.html', '.css')):
            chars |= set(open(f, encoding='utf-8').read())
    return chars

def gb2312_level1():
    out = set()
    for hi in range(0xB0, 0xD8):
        for lo in range(0xA1, 0xFF):
            try:
                out.add(bytes([hi, lo]).decode('gb2312'))
            except UnicodeDecodeError:
                pass
    return out

base = set(chr(c) for c in range(0x20, 0x7F)) | set('°℃·—–…“”‘’《》〈〉「」『』、。，：；！？（）【】～%＋±×→•') \
    | set('〇一二三四五六七八九十廿卅正腊冬闰初农历年月日甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥鼠牛虎兔龙蛇马羊猴鸡狗猪馬龍雞豬')
sets = {'400': base | source_chars() | gb2312_level1(), '700': base | source_chars()}

for w, path in SRC.items():
    col = TTCollection(path)
    idx = next(i for i, f in enumerate(col.fonts) if 'SC' in f['name'].getDebugName(1))
    font = col.fonts[idx]
    opts = subset.Options()
    opts.flavor = 'woff2'
    opts.layout_features = ['kern', 'tnum', 'lnum', 'pnum', 'palt', 'locl']
    opts.hinting = False
    s = subset.Subsetter(opts)
    s.populate(text=''.join(c for c in sets[w] if ord(c) >= 0x20))
    s.subset(font)
    out = f'src/assets/fonts/NotoSerifSC-{w}.subset.woff2'
    font.flavor = 'woff2'
    font.save(out)
    print(out, os.path.getsize(out) // 1024, 'KB')
