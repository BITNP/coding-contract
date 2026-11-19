#!/bin/sh
# 生成刊头徽记的三层素材（外发光 / 红边 / 金属白），需要 ffmpeg 和 typst。
# 用法：sh assets/make-emblem-glow.sh [白色透明底的徽记，SVG 或 PNG/WebP]
# 不带参数时使用 assets/logo.svg。
set -e
dir="$(cd "$(dirname "$0")" && pwd)"
src="${1:-$dir/logo.svg}"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

case "$src" in
  *.svg)
    abs="$(cd "$(dirname "$src")" && pwd)/$(basename "$src")"
    printf '#set page(width: 360pt, height: 360pt, margin: 0pt, fill: none)\n#image("%s", width: 100%%)\n' "$abs" > "$tmp/emblem.typ"
    typst compile --root / "$tmp/emblem.typ" "$tmp/emblem.png" --ppi 144
    src="$tmp/emblem.png"
    ;;
esac

fit="format=rgba,scale=360:360:force_original_aspect_ratio=decrease,pad=640:640:(ow-iw)/2:(oh-ih)/2:color=0x00000000"
ffmpeg -loglevel error -y -i "$src" -vf "$fit,colorchannelmixer=rr=1:gg=0.06:bb=0.07,gblur=sigma=30,colorchannelmixer=aa=0.9" "$dir/emblem-glow.png"
ffmpeg -loglevel error -y -i "$src" -vf "$fit,colorchannelmixer=rr=1:gg=0.1:bb=0.1,dilation,dilation,gblur=sigma=3,colorchannelmixer=aa=1.3" "$dir/emblem-rim.png"
ffmpeg -loglevel error -y -i "$src" -vf "$fit,geq=r='255-60*Y/H':g='255-75*Y/H':b='255-72*Y/H':a='alpha(X,Y)'" "$dir/emblem-metal.png"
echo "已生成 emblem-glow.png / emblem-rim.png / emblem-metal.png"
