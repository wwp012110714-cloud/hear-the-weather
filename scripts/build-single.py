"""
把 vite build 产物打包成一个可双击打开的单文件 HTML：
CSS / JS 内联，字体与图片转成 data URI，不依赖任何外部资源（离线也能显示宋体排版）。
用法：npm run build && python3 scripts/build-single.py <输出路径>
"""
import base64, mimetypes, re, sys, pathlib

dist = pathlib.Path('dist')
html = (dist / 'index.html').read_text(encoding='utf-8')
mimetypes.add_type('font/woff2', '.woff2')

def data_uri(path):
    p = (dist / path.lstrip('./')).resolve()
    mime = mimetypes.guess_type(str(p))[0] or 'application/octet-stream'
    return f'data:{mime};base64,' + base64.b64encode(p.read_bytes()).decode()

def inline_urls(css, base='assets/'):
    def rep(m):
        u = m.group(1).strip('\'"')
        if u.startswith('data:') or u.startswith('http'):
            return m.group(0)
        name = u.split('/')[-1]
        return f'url({data_uri(base + name)})'
    return re.sub(r'url\(([^)]+)\)', rep, css)

def css_tag(m):
    href = m.group(1)
    css = (dist / href.lstrip('./')).read_text(encoding='utf-8')
    return '<style>' + inline_urls(css) + '</style>'

def js_tag(m):
    src = m.group(1)
    js = (dist / src.lstrip('./')).read_text(encoding='utf-8')
    # JS 中引用的静态资源（如 new URL）同样转成 data URI
    js = re.sub(r'"(\./)?assets/([^"]+\.(?:woff2|jpg|png|svg))"', lambda mm: '"' + data_uri('assets/' + mm.group(2)) + '"', js)
    js = js.replace('</script', '<\\/script')
    return '<script type="module">' + js + '</script>'

html = re.sub(r'<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>', css_tag, html)
html = re.sub(r'<script type="module"[^>]*src="([^"]+)"[^>]*></script>', js_tag, html)
html = re.sub(r'<link rel="icon"[^>]*href="\./favicon\.svg"[^>]*>',
              lambda m: m.group(0).replace('./favicon.svg', data_uri('favicon.svg')) if (dist / 'favicon.svg').exists() else '', html)
html = re.sub(r'<link rel="modulepreload"[^>]*>', '', html)

out = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'dist/single.html')
out.write_text(html, encoding='utf-8')
left = re.findall(r'(?:src|href)="\./assets/[^"]+"', html)
print(out, round(out.stat().st_size / 1024), 'KB', '剩余外链:', left)
