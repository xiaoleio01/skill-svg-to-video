#!/usr/bin/env bun
/**
 * Content SVG Generator - Simplified version with MiniMax API
 */

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

// Configuration - 使用文生图接口文档的API
const IMAGE_API_KEY = "XXXXX";
const IMAGE_API_URL = "https://sg2.dchai.cn/v1/chat/completions";
const IMAGE_MODEL = "Nano_Banana_2_2K_0";
const CHARS_PER_SECOND = 3.5;
const OUTPUT_BASE = join(process.env.HOME ?? ".", "Desktop", "内容SVG输出");

// Style presets with better prompt engineering
const STYLE_PROMPTS: Record<string, { base: string; texture: string; mood: string; typography: string }> = {
  "bold-editorial": {
    base: "Editorial magazine cover, bold typography, dramatic composition, vibrant colors",
    texture: "clean with bold graphic elements",
    mood: "vibrant, high-contrast",
    typography: "bold editorial headlines"
  },
  "notion": {
    base: "Clean minimalist design, geometric shapes, professional aesthetic",
    texture: "clean grid-based layout",
    mood: "neutral professional",
    typography: "geometric sans-serif"
  },
  "blueprint": {
    base: "Technical blueprint style, grid background, precise lines",
    texture: "grid paper texture",
    mood: "cool technical",
    typography: "technical schematic"
  },
  "sketch-notes": {
    base: "Hand-drawn illustration, sketch style, warm and approachable",
    texture: "organic paper texture",
    mood: "warm handwritten",
    typography: "handwritten notes"
  },
  "watercolor": {
    base: "Soft watercolor illustration, artistic gentle colors",
    texture: "organic flowing",
    mood: "warm artistic",
    typography: "elegant humanist"
  },
  "chalkboard": {
    base: "Chalkboard drawing, hand-drawn on dark background",
    texture: "dark slate with chalk dust",
    mood: "warm educational",
    typography: "handwritten chalk"
  },
};

// Content type to style mapping
const CONTENT_TYPE_STYLES: Record<string, string[]> = {
  "新闻": ["bold-editorial", "notion", "blueprint"],
  "故事": ["sketch-notes", "watercolor", "chalkboard"],
  "教学": ["chalkboard", "sketch-notes", "blueprint"],
  "科普": ["blueprint", "notion", "bold-editorial"],
  "知识分享": ["notion", "blueprint", "bold-editorial"],
  "产品介绍": ["notion", "bold-editorial", "blueprint"],
  "其他": ["bold-editorial", "notion", "blueprint"],
};

// Palettes for SVG placeholders
const PALETTES = [
  ["#667eea", "#764ba2", "#f093fb", "#f5576c"],
  ["#4facfe", "#00f2fe", "#43e97b", "#38f9d7"],
  ["#fa709a", "#fee140", "#fa709a", "#f83600"],
  ["#a8edea", "#fed6e3", "#d299c2", "#fef9d7"],
  ["#5ee7df", "#b490ca", "#d7385e", "#756c99"],
  ["#ff6b6b", "#4ecdc4", "#45b7d1", "#96ceb4"],
];

interface Slide {
  id: number;
  content: string;
  duration: number;
  imageUrl?: string;
}

// Call Image Generation API (文生图接口文档)
async function generateImage(prompt: string, outputPath: string): Promise<boolean> {
  if (!IMAGE_API_KEY) {
    console.log("   ⚠️  未设置 IMAGE_API_KEY，使用占位图");
    return false;
  }

  try {
    const payload = {
      model: IMAGE_MODEL,
      messages: [
        {
          role: "user",
          content: `${prompt}，图片长宽比9:16`
        }
      ]
    };

    const response = await fetch(IMAGE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${IMAGE_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (result.choices && result.choices[0]?.message?.content) {
      const content = result.choices[0].message.content;
      // Extract image URLs from markdown format: ![1](url) or ![image](url)
      const imageMatches = content.matchAll(/!\[.*?\]\((https?:\/\/[^\)]+)\)/g);
      const imageUrls = [...imageMatches].map(m => m[1]);

      if (imageUrls.length > 0) {
        // Download first image
        const imgResponse = await fetch(imageUrls[0]);
        const buffer = await imgResponse.arrayBuffer();
        writeFileSync(outputPath, Buffer.from(buffer));
        return true;
      }
    }

    console.log(`   ⚠️  API响应格式错误或无图片`);
  } catch (e: any) {
    console.log(`   ⚠️  请求失败: ${e.message}`);
  }
  return false;
}

// Call AI for content splitting (使用文生图接口)
async function callAI(prompt: string, maxTokens: number = 2000): Promise<string> {
  if (!IMAGE_API_KEY) {
    // Fallback: simple paragraph split
    return "";
  }

  try {
    const response = await fetch(IMAGE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${IMAGE_API_KEY}`
      },
      body: JSON.stringify({
        model: IMAGE_MODEL,
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }]
      })
    });

    const result = await response.json();
    if (result.choices && result.choices[0]?.message?.content) {
      return result.choices[0].message.content.trim();
    }
  } catch (e) {
    console.log(`   ⚠️  AI调用失败`);
  }
  return "";
}

// Detect content type
function detectContentType(content: string): string {
  const lower = content.toLowerCase();
  if (/新闻|报道|记者|融资|收购|上市/.test(lower)) return "新闻";
  if (/故事|从前|讲述|人生|经历/.test(lower)) return "故事";
  if (/教学|教程|学习|课程|讲解/.test(lower)) return "教学";
  if (/科学|原理|解释|为什么|如何/.test(lower)) return "科普";
  if (/分享|经验|心得|体会/.test(lower)) return "知识分享";
  if (/产品|功能|特点|优势/.test(lower)) return "产品介绍";
  return "新闻"; // Default for news content
}

// Detect style based on content type
function detectStyle(contentType: string): string {
  const styles = CONTENT_TYPE_STYLES[contentType] || CONTENT_TYPE_STYLES["其他"];
  return styles[0];
}

// Build enhanced prompt for image generation
function buildImagePrompt(style: string, contentType: string, slideContent: string): string {
  const styleConfig = STYLE_PROMPTS[style] || STYLE_PROMPTS["bold-editorial"];

  const typeVisual: Record<string, string> = {
    "新闻": "Modern digital news graphic, dynamic composition, financial/business news aesthetic",
    "故事": "Narrative illustration, emotional storytelling visual, engaging scene",
    "教学": "Educational diagram, clear visual explanation, learning aid style",
    "科普": "Scientific visualization, infographic style, data-driven graphic",
    "知识分享": "Clean informative graphic, modern design, shareable visual",
    "产品介绍": "Professional product showcase, clean corporate style, feature highlight",
    "其他": "Contemporary digital art, vibrant modern aesthetic"
  };

  const typeVisualStr = typeVisual[contentType] || typeVisual["其他"];

  return `${typeVisualStr}, ${styleConfig.base}, ${styleConfig.texture}, ${styleConfig.mood} mood, ${styleConfig.typography}. Content: ${slideContent.slice(0, 80)}`;
}

// Split content into slides
async function splitContent(content: string, slideCount?: number): Promise<string[]> {
  // Clean the content first
  content = content.replace(/^口播文案：/, "").trim();

  // Simple paragraph-based split for news content
  const paragraphs = content.split(/\n+/).filter(p => p.trim());

  // If we have specific slide count, adjust
  if (slideCount && slideCount > 0) {
    const totalChars = content.length;
    const charsPerSlide = Math.ceil(totalChars / slideCount);

    const slides: string[] = [];
    let currentSlide = "";
    let currentChars = 0;

    for (const para of paragraphs) {
      if (currentChars + para.length > charsPerSlide && slides.length < slideCount - 1) {
        if (currentSlide) slides.push(currentSlide.trim());
        currentSlide = para;
        currentChars = para.length;
      } else {
        currentSlide += "\n\n" + para;
        currentChars += para.length;
      }
    }
    if (currentSlide) slides.push(currentSlide.trim());
    return slides;
  }

  // Default: smart split based on content structure
  const slides: string[] = [];
  let currentSlide = "";
  let lastBreak = 0;

  // Split by sentence-ending punctuation and group into slides
  const sentences = content.match(/[^。！？.!?]+[。！？.!?]+/g) || [content];

  for (const sentence of sentences) {
    currentSlide += sentence;
    if (currentSlide.length > 80 && slides.length < 10) {
      slides.push(currentSlide.trim());
      currentSlide = "";
    }
  }
  if (currentSlide.trim()) slides.push(currentSlide.trim());

  return slides.length > 0 ? slides : [content];
}

// Generate SVG placeholder
function getPlaceholderSvg(palette: string[], keyword: string): string {
  const [c1, c2, c3, c4] = palette;
  const hash = keyword.split("").reduce((a, c) => a + c.charCodeAt(0), 0);

  return `<svg viewBox="0 0 400 225" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${c1}" stop-opacity="0.4"/>
        <stop offset="50%" stop-color="${c2}" stop-opacity="0.3"/>
        <stop offset="100%" stop-color="${c4}" stop-opacity="0.4"/>
      </linearGradient>
    </defs>
    <rect width="400" height="225" fill="url(#g)" rx="8"/>
    <circle cx="${180 + hash % 40}" cy="${100 + hash % 30}" r="${40 + hash % 20}" fill="${c1}" opacity="0.3"/>
    <rect x="${50 + hash % 50}" y="${80 + hash % 40}" width="${60 + hash % 30}" height="${40 + hash % 20}" rx="4" fill="${c2}" opacity="0.3"/>
  </svg>`;
}

// Generate SVG slideshow
function generateSvg(slidesContent: string[], topic: string, generatedImages: Map<number, string>, style: string): { html: string; slidesData: Slide[] } {
  const today = new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });

  const slidesHtml: string[] = [];
  const slidesData: Slide[] = [];

  for (let idx = 0; idx < slidesContent.length; idx++) {
    const content = slidesContent[idx];
    const palette = PALETTES[idx % PALETTES.length];

    let imgHtml: string;
    const imagePath = generatedImages.get(idx);
    if (imagePath && existsSync(imagePath)) {
      imgHtml = `<img src="${imagePath}" alt="配图" style="width:100%;height:100%;object-fit:cover;border-radius:12px;"/>`;
    } else {
      imgHtml = getPlaceholderSvg(palette, content.slice(0, 20));
    }

    const durationMs = Math.max(Math.floor((content.length / CHARS_PER_SECOND) * 1000), 4000);

    slidesHtml.push(`
        <div class="slide" id="slide-${idx}">
            <div class="slide-bg"></div>
            <div class="content-area">
                <div class="image-container">${imgHtml}</div>
            </div>
        </div>
    `);

    slidesData.push({ id: idx, content, duration: durationMs, imageUrl: imagePath });
  }

  const slidesJs = slidesData.map(s => `{ id: ${s.id}, duration: ${s.duration} }`).join(",");

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>${topic}</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'PingFang SC', 'Microsoft YaHei', -apple-system, sans-serif; background: #0a0a0f; color: #fff; overflow: hidden; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
.container { position: relative; width: 100vmin; height: 177.78vmin; max-width: 450px; max-height: 800px; background: linear-gradient(160deg, #1a1a2e 0%, #16213e 50%, #0f0f1a 100%); overflow: hidden; border-radius: 16px; box-shadow: 0 30px 100px rgba(0,0,0,0.6); }
.slide { position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; transition: opacity 0.8s ease; pointer-events: none; }
.slide.active { opacity: 1; pointer-events: auto; }
.slide-bg { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: linear-gradient(180deg, rgba(20,20,40,0.97) 0%, rgba(10,10,20,0.99) 100%); z-index: 0; }
.content-area { position: relative; z-index: 10; height: 100%; padding: 0; display: flex; align-items: stretch; justify-content: center; }
.image-container { width: 100%; height: 100%; border-radius: 0; overflow: hidden; background: rgba(255,255,255,0.05); }
.image-container img { display: block; width: 100%; height: 100%; object-fit: cover; }
.image-container svg { display: block; width: 100%; height: auto; }
</style>
</head>
<body>
<div class="container" id="slideshow">
    ${slidesHtml.join("\n")}
</div>
<script>
var slides = [${slidesJs}];
var currentSlide = 0;
var autoTimer = null;

function showSlide(index) {
    document.querySelectorAll('.slide').forEach(function(s) { s.classList.remove('active'); });
    var slideEl = document.getElementById('slide-' + index);
    if (slideEl) { slideEl.classList.add('active'); }
    currentSlide = index;
    if (autoTimer) clearTimeout(autoTimer);
    autoTimer = setTimeout(function() { showSlide((currentSlide + 1) % slides.length); }, slides[index].duration);
}

var touchStartX = 0;
document.getElementById('slideshow').addEventListener('touchstart', function(e) { touchStartX = e.touches[0].clientX; });
document.getElementById('slideshow').addEventListener('touchend', function(e) {
    var diff = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
        if (diff > 0) { showSlide((currentSlide + 1) % slides.length); }
        else { showSlide((currentSlide - 1 + slides.length) % slides.length); }
    }
});

document.addEventListener('keydown', function(e) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') { e.preventDefault(); showSlide((currentSlide + 1) % slides.length); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); showSlide((currentSlide - 1 + slides.length) % slides.length); }
});

document.querySelector('.container').addEventListener('click', function(e) {
    if (e.target.closest('.slide')) { showSlide((currentSlide + 1) % slides.length); }
});

showSlide(0);
</script>
</body>
</html>`;

  return { html, slidesData };
}

// Main function
async function main(content: string, topic?: string, slideCount?: number) {
  const today = new Date().toISOString().slice(0, 10);
  const outputDir = join(OUTPUT_BASE, today);
  mkdirSync(outputDir, { recursive: true });

  if (!topic) {
    topic = content.slice(0, 30).replace(/\n/g, " ").trim();
    if (content.length > 30) topic += "...";
  }

  console.log(`📁 输出目录: ${outputDir}`);
  console.log(`📝 内容主题: ${topic}`);
  console.log();

  // Detect content type
  const contentType = detectContentType(content);
  console.log(`🔍 内容类型: ${contentType}`);

  // Detect style
  const style = detectStyle(contentType);
  console.log(`🎨 选用风格: ${style}`);
  console.log();

  // Split content
  console.log(`✂️  拆分内容...`);
  const slidesContent = await splitContent(content, slideCount || 5);
  console.log(`   拆分数量: ${slidesContent.length}页`);
  for (let i = 0; i < slidesContent.length; i++) {
    const preview = slidesContent[i].slice(0, 50).replace(/\n/g, " ");
    console.log(`   [${i + 1}] ${preview}...`);
  }
  console.log();

  // Generate images
  console.log(`🎨 正在生成 ${slidesContent.length} 张配图...`);
  const generatedImages = new Map<number, string>();

  for (let idx = 0; idx < slidesContent.length; idx++) {
    const slideText = slidesContent[idx];
    console.log(`   [${idx + 1}/${slidesContent.length}] 正在生成配图...`);

    const prompt = buildImagePrompt(style, contentType, slideText);
    console.log(`       提示词: ${prompt.slice(0, 50)}...`);

    const imagePath = join(outputDir, `slide-${String(idx + 1).padStart(2, "0")}-image.png`);
    const success = await generateImage(prompt, imagePath);

    if (success) {
      generatedImages.set(idx, imagePath);
      console.log(`       ✅ 配图生成成功`);
    } else {
      console.log(`       ⚠️  使用占位图`);
    }
  }

  console.log();
  console.log(`📄 生成幻灯片...`);

  const { html, slidesData } = generateSvg(slidesContent, topic, generatedImages, style);

  const htmlPath = join(outputDir, "内容展示.html");
  writeFileSync(htmlPath, html, "utf-8");
  console.log(`   ✅ 已保存: 内容展示.html (${slidesData.length}页)`);

  // Save broadcast content
  const mdContent = slidesContent.join("\n\n");
  const mdPath = join(outputDir, "播报内容.md");
  writeFileSync(mdPath, mdContent, "utf-8");
  console.log(`   ✅ 已保存: 播报内容.md`);

  const totalDur = slidesData.reduce((sum, s) => sum + s.duration, 0);
  const successImages = generatedImages.size;

  console.log();
  console.log("═".repeat(50));
  console.log(`✅ 完成！`);
  console.log(`📁 ${outputDir}`);
  console.log(`📄 内容展示.html (${slidesData.length}页)`);
  console.log(`🎨 成功生成 ${successImages} 张配图`);
  console.log(`⏱️  自动翻页总时长: ${(totalDur / 1000).toFixed(0)}秒`);
  console.log("═".repeat(50));
}

// CLI entry point
const args = process.argv.slice(2);
if (args.length < 1) {
  console.log("用法: bun main.ts <内容> [主题] [幻灯片数量]");
  console.log("示例: bun main.ts '内容...' '主题' 5");
  process.exit(1);
}

const content = args[0];
const topic = args[1];
const slideCount = args[2] ? parseInt(args[2]) : undefined;

main(content, topic, slideCount).catch(console.error);
