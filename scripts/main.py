#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Content SVG Generator - Enhanced version with better prompts
"""

import os
import sys
import json
import re
import urllib.request
import urllib.error
from datetime import datetime
from pathlib import Path

# Configuration - 使用文生图接口文档的API
IMAGE_API_KEY = "XXXXXXX"
IMAGE_API_URL = "https://sg2.dchai.cn/v1/chat/completions"
IMAGE_MODEL = "Nano_Banana_2_2K_0"

CHARS_PER_SECOND = 3.5
OUTPUT_BASE = os.path.expanduser("~/Desktop/内容SVG输出")

# Style presets - subdued colors suitable for news/editorial
STYLE_PROMPTS = {
    "bold-editorial": {
        "base": "Editorial news style, clean professional layout, documentary aesthetic",
        "texture": "subtle matte finish, refined textures",
        "mood": "professional, understated, trustworthy",
        "typography": "clean sans-serif headlines"
    },
    "notion": {
        "base": "Clean minimalist design, geometric shapes, professional aesthetic",
        "texture": "clean grid-based layout",
        "mood": "neutral professional",
        "typography": "geometric sans-serif"
    },
    "blueprint": {
        "base": "Technical blueprint style, grid background, precise lines",
        "texture": "grid paper texture",
        "mood": "cool technical",
        "typography": "technical schematic"
    },
    "sketch-notes": {
        "base": "Hand-drawn illustration, sketch style, warm and approachable",
        "texture": "organic paper texture",
        "mood": "warm handwritten",
        "typography": "handwritten notes"
    },
    "watercolor": {
        "base": "Soft watercolor illustration, artistic gentle colors",
        "texture": "organic flowing",
        "mood": "warm artistic",
        "typography": "elegant humanist"
    },
    "chalkboard": {
        "base": "Chalkboard drawing, hand-drawn on dark background",
        "texture": "dark slate with chalk dust",
        "mood": "warm educational",
        "typography": "handwritten chalk"
    },
}

# Content type to style mapping
CONTENT_TYPE_STYLES = {
    "新闻": ["bold-editorial", "notion", "blueprint"],
    "故事": ["sketch-notes", "watercolor", "chalkboard"],
    "教学": ["chalkboard", "sketch-notes", "blueprint"],
    "科普": ["blueprint", "notion", "bold-editorial"],
    "知识分享": ["notion", "blueprint", "bold-editorial"],
    "产品介绍": ["notion", "bold-editorial", "blueprint"],
    "其他": ["bold-editorial", "notion", "blueprint"],
}

# Palettes for SVG placeholders
PALETTES = [
    ["#667eea", "#764ba2", "#f093fb", "#f5576c"],
    ["#4facfe", "#00f2fe", "#43e97b", "#38f9d7"],
    ["#fa709a", "#fee140", "#fa709a", "#f83600"],
    ["#a8edea", "#fed6e3", "#d299c2", "#fef9d7"],
    ["#5ee7df", "#b490ca", "#d7385e", "#756c99"],
    ["#ff6b6b", "#4ecdc4", "#45b7d1", "#96ceb4"],
]


def call_ai_chat(prompt, max_tokens=2000):
    """Call Image Generation API for content splitting (文生图接口文档)."""
    if not IMAGE_API_KEY:
        return None

    try:
        payload = {
            "model": IMAGE_MODEL,
            "max_tokens": max_tokens,
            "messages": [{"role": "user", "content": prompt}]
        }
        data = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(
            IMAGE_API_URL, data=data,
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {IMAGE_API_KEY}"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=60) as response:
            result = json.loads(response.read().decode('utf-8'))
        if result.get('choices') and result['choices'][0].get('message', {}).get('content'):
            return result['choices'][0]['message']['content'].strip()
        return None
    except Exception as e:
        print(f"   ⚠️  AI调用失败: {e}")
        return None


def generate_image(prompt, output_path):
    """Generate image using Image Generation API (文生图接口文档)."""
    if not IMAGE_API_KEY:
        print("   ⚠️  未设置 IMAGE_API_KEY，使用占位图")
        return False

    try:
        payload = {
            "model": IMAGE_MODEL,
            "messages": [
                {
                    "role": "user",
                    "content": f"{prompt}，图片长宽比9:16"
                }
            ]
        }
        data = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(
            IMAGE_API_URL, data=data,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {IMAGE_API_KEY}"
            },
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=120) as response:
            result = json.loads(response.read().decode('utf-8'))

        if result.get('choices') and result['choices'][0].get('message', {}).get('content'):
            content = result['choices'][0]['message']['content']
            # Extract image URLs from markdown format: ![1](url) or ![image](url)
            image_matches = re.findall(r'!\[.*?\]\((https?://[^)]+)\)', content)
            if image_matches:
                # Download first image
                img_req = urllib.request.Request(image_matches[0])
                with urllib.request.urlopen(img_req, timeout=60) as img_response:
                    with open(output_path, 'wb') as f:
                        f.write(img_response.read())
                return True
            else:
                print(f"   ⚠️  API响应中未找到图片URL")
        else:
            print(f"   ⚠️  API响应格式错误")
    except Exception as e:
        print(f"   ⚠️  请求失败: {e}")
    return False


def detect_content_type(content):
    """Detect content type based on content."""
    lower = content.lower()
    if any(k in lower for k in ['新闻', '报道', '记者', '融资', '收购', '上市', '投资']):
        return "新闻"
    if any(k in lower for k in ['故事', '从前', '讲述', '人生', '经历']):
        return "故事"
    if any(k in lower for k in ['教学', '教程', '学习', '课程', '讲解']):
        return "教学"
    if any(k in lower for k in ['科学', '原理', '解释', '为什么', '如何']):
        return "科普"
    if any(k in lower for k in ['分享', '经验', '心得', '体会']):
        return "知识分享"
    if any(k in lower for k in ['产品', '功能', '特点', '优势']):
        return "产品介绍"
    return "新闻"


def detect_style(content_type):
    """Detect style based on content type."""
    styles = CONTENT_TYPE_STYLES.get(content_type, CONTENT_TYPE_STYLES["其他"])
    return styles[0]


def build_image_prompt(style, content_type, slide_content):
    """Build enhanced prompt for image generation - 不嵌入播报内容，只生成与场景契合的背景图."""
    style_config = STYLE_PROMPTS.get(style, STYLE_PROMPTS["bold-editorial"])

    # 场景提示词映射 - 描述内容场景而非嵌入文字
    type_scene = {
        "新闻": "News broadcast studio setting, professional journalism environment, neutral backdrop",
        "故事": "Narrative scene illustration, emotional atmosphere, storytelling setting",
        "教学": "Classroom teaching environment, educational setting, learning atmosphere",
        "科普": "Scientific research laboratory, technology visualization, data-driven environment",
        "知识分享": "Modern knowledge workspace, professional sharing environment, clean backdrop",
        "产品介绍": "Professional product showcase, clean corporate environment, modern setting",
        "其他": "Contemporary professional setting, clean modern backdrop, neutral aesthetic"
    }

    scene_str = type_scene.get(content_type, type_scene["其他"])

    return f"Professional news graphic design, {scene_str}, {style_config['base']}, {style_config['texture']}, {style_config['mood']} mood, {style_config['typography']}. 9:16 vertical format, subtle muted tones, no text overlay"


def split_content(content, slide_count=None):
    """Split content into slides."""
    # Clean the content first
    content = re.sub(r'^口播文案：', '', content).strip()

    # Simple paragraph-based split
    paragraphs = [p.strip() for p in content.split('\n\n') if p.strip()]

    if not paragraphs:
        paragraphs = [content]

    # If we have specific slide count, adjust
    if slide_count and slide_count > 0:
        total_chars = len(content)
        chars_per_slide = total_chars / slide_count

        slides = []
        current_slide = ""
        current_chars = 0

        for para in paragraphs:
            if current_chars + len(para) > chars_per_slide and len(slides) < slide_count - 1:
                if current_slide:
                    slides.append(current_slide.strip())
                current_slide = para
                current_chars = len(para)
            else:
                current_slide += "\n\n" + para
                current_chars += len(para)

        if current_slide.strip():
            slides.append(current_slide.strip())

        return slides if slides else paragraphs[:slide_count]

    # Default: group by sentences
    slides = []
    current_slide = ""

    # Split by Chinese punctuation
    sentences = re.findall(r'[^。！？.!?]+[。！？.!?]+', content)

    if not sentences:
        sentences = [content[i:i+100] for i in range(0, len(content), 100)]

    for sentence in sentences:
        current_slide += sentence
        if len(current_slide) > 150 and len(slides) < 9:
            slides.append(current_slide.strip())
            current_slide = ""

    if current_slide.strip():
        slides.append(current_slide.strip())

    return slides if slides else [content]


def get_placeholder_svg(palette, keyword):
    """Generate SVG placeholder."""
    c1, c2, c3, c4 = palette
    keyword_hash = sum(ord(c) for c in keyword[:20])

    shapes = []
    for i in range(5):
        x = 50 + (keyword_hash * (i+1) * 7) % 200
        y = 50 + (keyword_hash * (i+1) * 11) % 150
        r = 20 + (keyword_hash * (i+1)) % 50
        opacity = 0.1 + (keyword_hash * (i+1)) % 15 / 100
        shape_type = (keyword_hash + i) % 3

        if shape_type == 0:
            shapes.append(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{c1}" opacity="{opacity}"><animate attributeName="r" values="{r};{r+10};{r}" dur="{3+i}s" repeatCount="indefinite"/></circle>')
        elif shape_type == 1:
            shapes.append(f'<rect x="{x-r}" y="{y-r}" width="{r*2}" height="{r*2}" rx="10" fill="{c2}" opacity="{opacity}" transform="rotate({keyword_hash+i*15} {x} {y})"><animateTransform attributeName="transform" type="rotate" from="0 {x} {y}" to="360 {x} {y}" dur="{10+i*2}s" repeatCount="indefinite"/></rect>')
        else:
            shapes.append(f'<polygon points="{x},{y-r} {x+r},{y+r} {x-r},{y+r}" fill="{c3}" opacity="{opacity}"><animate attributeName="opacity" values="{opacity};{opacity+0.1};{opacity}" dur="{4+i}s" repeatCount="indefinite"/></polygon>')

    svg = f'''
    <svg viewBox="0 0 400 225" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="{c1}" stop-opacity="0.3"/>
                <stop offset="50%" stop-color="{c2}" stop-opacity="0.2"/>
                <stop offset="100%" stop-color="{c4}" stop-opacity="0.3"/>
            </linearGradient>
            <radialGradient id="glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stop-color="{c1}" stop-opacity="0.4"/>
                <stop offset="100%" stop-color="{c1}" stop-opacity="0"/>
            </radialGradient>
        </defs>
        <rect width="400" height="225" fill="url(#grad)" rx="8"/>
        <circle cx="200" cy="112" r="80" fill="url(#glow)">
            <animate attributeName="r" values="80;95;80" dur="5s" repeatCount="indefinite"/>
            <animate attributeName="opacity" values="0.5;0.8;0.5" dur="5s" repeatCount="indefinite"/>
        </circle>
        {''.join(shapes)}
    </svg>'''
    return svg


def generate_svg(slides_content, topic, generated_images, style):
    """Generate SVG slideshow."""
    slides_html = []
    slides_data = []

    for idx, content in enumerate(slides_content):
        palette = PALETTES[idx % len(PALETTES)]
        c1, c2, c3, c4 = palette

        image_path = generated_images.get(idx)
        if image_path and os.path.exists(image_path):
            img_html = f'<img src="{image_path}" alt="配图" style="width:100%;height:100%;object-fit:cover;border-radius:12px;"/>'
        else:
            svg_placeholder = get_placeholder_svg(palette, content[:20])
            img_html = svg_placeholder

        total_chars = len(content)
        duration_ms = max(int((total_chars / CHARS_PER_SECOND) * 1000), 4000)

        slides_html.append(f'''
        <div class="slide" id="slide-{idx}">
            <div class="slide-bg"></div>
            <div class="content-area">
                <div class="image-section">
                    <div class="image-container">{img_html}</div>
                </div>
                <div class="text-section">
                    <p class="slide-content">{content}</p>
                </div>
            </div>
        </div>
        ''')

        slides_data.append({
            'id': idx,
            'content': content,
            'duration': duration_ms,
            'image_url': image_path
        })

    slides_js = ','.join([f"{{ id: {s['id']}, duration: {s['duration']} }}" for s in slides_data])

    html = f'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>{topic}</title>
<style>
* {{ margin: 0; padding: 0; box-sizing: border-box; }}
body {{ font-family: 'PingFang SC', 'Microsoft YaHei', -apple-system, sans-serif; background: #0a0a0f; color: #fff; overflow: hidden; display: flex; justify-content: center; align-items: center; min-height: 100vh; }}
.container {{ position: relative; width: 100vmin; height: 177.78vmin; max-width: 450px; max-height: 800px; background: linear-gradient(160deg, #1a1a2e 0%, #16213e 50%, #0f0f1a 100%); overflow: hidden; border-radius: 16px; box-shadow: 0 30px 100px rgba(0,0,0,0.6); }}
.slide {{ position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; transition: opacity 0.8s ease; pointer-events: none; }}
.slide.active {{ opacity: 1; pointer-events: auto; }}
.slide-bg {{ position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: linear-gradient(180deg, rgba(20,20,40,0.97) 0%, rgba(10,10,20,0.99) 100%); z-index: 0; }}
.content-area {{ position: relative; z-index: 10; height: 100%; display: flex; flex-direction: column; padding: 40px 28px; gap: 20px; }}
.image-section {{ flex: 1; display: flex; align-items: center; justify-content: center; min-height: 35%; }}
.image-container {{ width: 100%; max-height: 220px; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.5); background: rgba(255,255,255,0.05); }}
.image-container img {{ display: block; width: 100%; height: 100%; object-fit: cover; }}
.image-container svg {{ display: block; width: 100%; height: auto; }}
.text-section {{ flex: 1; display: flex; flex-direction: column; justify-content: flex-start; gap: 16px; overflow: hidden; }}
.slide-content {{ font-size: 16px; line-height: 1.8; color: rgba(255,255,255,0.9); opacity: 0; transform: translateY(20px); overflow-wrap: break-word; }}
.slide.active .slide-content {{ animation: slideUp 0.7s ease forwards 0.3s; }}
@keyframes slideUp {{ to {{ opacity: 1; transform: translateY(0); }} }}
</style>
</head>
<body>
<div class="container" id="slideshow">
    {''.join(slides_html)}
</div>
<script>
var slides = [{slides_js}];
var currentSlide = 0;
var autoTimer = null;

function showSlide(index) {{
    document.querySelectorAll('.slide').forEach(function(s) {{ s.classList.remove('active'); }});
    var slideEl = document.getElementById('slide-' + index);
    if (slideEl) {{ slideEl.classList.add('active'); }}
    currentSlide = index;
    if (autoTimer) clearTimeout(autoTimer);
    autoTimer = setTimeout(function() {{ showSlide((currentSlide + 1) % slides.length); }}, slides[index].duration);
}}

var touchStartX = 0;
document.getElementById('slideshow').addEventListener('touchstart', function(e) {{ touchStartX = e.touches[0].clientX; }});
document.getElementById('slideshow').addEventListener('touchend', function(e) {{
    var diff = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {{
        if (diff > 0) {{ showSlide((currentSlide + 1) % slides.length); }}
        else {{ showSlide((currentSlide - 1 + slides.length) % slides.length); }}
    }}
}});

document.addEventListener('keydown', function(e) {{
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {{ e.preventDefault(); showSlide((currentSlide + 1) % slides.length); }}
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {{ e.preventDefault(); showSlide((currentSlide - 1 + slides.length) % slides.length); }}
}});

document.querySelector('.container').addEventListener('click', function(e) {{
    if (e.target.closest('.slide')) {{ showSlide((currentSlide + 1) % slides.length); }}
}});

showSlide(0);
</script>
</body>
</html>'''

    return html, slides_data


def main(content, topic=None, slide_count=None):
    """Main function."""
    today = datetime.now().strftime('%Y-%m-%d')
    output_dir = os.path.join(OUTPUT_BASE, today)
    os.makedirs(output_dir, exist_ok=True)

    if not topic:
        topic = content[:30].replace('\n', ' ').strip()
        if len(content) > 30:
            topic += '...'

    print(f"📁 输出目录: {output_dir}")
    print(f"📝 内容主题: {topic}")
    print()

    # Detect content type
    content_type = detect_content_type(content)
    print(f"🔍 内容类型: {content_type}")

    # Detect style
    style = detect_style(content_type)
    print(f"🎨 选用风格: {style}")
    print()

    # Split content
    print(f"✂️  拆分内容...")
    slides_content = split_content(content, slide_count)
    print(f"   拆分数量: {len(slides_content)}页")
    for i, s in enumerate(slides_content):
        preview = s[:50].replace('\n', ' ')
        print(f"   [{i+1}] {preview}...")
    print()

    # Generate images
    print(f"🎨 正在生成 {len(slides_content)} 张配图...")
    generated_images = {}

    for idx, slide_text in enumerate(slides_content):
        print(f"   [{idx+1}/{len(slides_content)}] 正在生成配图...")

        prompt = build_image_prompt(style, content_type, slide_text)
        print(f"       提示词: {prompt[:60]}...")

        image_path = os.path.join(output_dir, f"slide-{idx+1:02d}-image.png")
        success = generate_image(prompt, image_path)

        if success:
            generated_images[idx] = image_path
            print(f"       ✅ 配图生成成功")
        else:
            print(f"       ⚠️  使用占位图")

    print()
    print(f"📄 生成幻灯片...")

    svg_html, slides_data = generate_svg(slides_content, topic, generated_images, style)

    html_path = os.path.join(output_dir, "内容展示.html")
    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(svg_html)
    print(f"   ✅ 已保存: 内容展示.html ({len(slides_data)}页)")

    # Save broadcast content
    md_content = '\n\n'.join(slides_content)
    md_path = os.path.join(output_dir, "播报内容.md")
    with open(md_path, 'w', encoding='utf-8') as f:
        f.write(md_content)
    print(f"   ✅ 已保存: 播报内容.md")

    total_dur = sum(s['duration'] for s in slides_data)
    success_images = len(generated_images)

    print()
    print("=" * 50)
    print(f"✅ 完成！")
    print(f"📁 {output_dir}")
    print(f"📄 内容展示.html ({len(slides_data)}页)")
    print(f"🎨 成功生成 {success_images} 张配图")
    print(f"⏱️  自动翻页总时长: {total_dur/1000:.0f}秒")
    print("=" * 50)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("用法: python main.py <内容> [主题] [幻灯片数量]")
        print("示例: python main.py '内容...' '主题' 5")
        sys.exit(1)

    content = sys.argv[1]
    topic = sys.argv[2] if len(sys.argv) > 2 else None
    slide_count = int(sys.argv[3]) if len(sys.argv) > 3 else None

    main(content, topic, slide_count)
