#!/usr/bin/env node
/**
 * Content SVG Generator - Node.js version
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

const IMAGE_API_KEY = "XXXXX";
const IMAGE_API_URL = "sg2.dchai.cn";
const IMAGE_MODEL = "Nano_Banana_2_2K_0";
const CHARS_PER_SECOND = 3.5;
const OUTPUT_BASE = path.join(os.homedir(), "Desktop", "内容SVG输出");

const PALETTES = [
  ["#667eea", "#764ba2", "#f093fb", "#f5576c"],
  ["#4facfe", "#00f2fe", "#43e97b", "#38f9d7"],
  ["#fa709a", "#fee140", "#fa709a", "#f83600"],
  ["#a8edea", "#fed6e3", "#d299c2", "#fef9d7"],
  ["#5ee7df", "#b490ca", "#d7385e", "#756c99"],
  ["#ff6b6b", "#4ecdc4", "#45b7d1", "#96ceb4"],
];

function detectContentType(content) {
  return "新闻";
}

function detectStyle(contentType) {
  return "bold-editorial";
}

// Build enhanced prompt - 不嵌入播报内容，只生成与场景契合的背景图
function buildImagePrompt(style, contentType, slideContent) {
  const base = "Editorial news style, clean professional layout, documentary aesthetic";

  // 场景提示词映射 - 描述内容场景而非嵌入文字
  const typeScene = {
    "新闻": "News broadcast studio setting, professional journalism environment, neutral backdrop",
    "故事": "Narrative scene illustration, emotional atmosphere, storytelling setting",
    "教学": "Classroom teaching environment, educational setting, learning atmosphere",
    "科普": "Scientific research laboratory, technology visualization, data-driven environment",
    "知识分享": "Modern knowledge workspace, professional sharing environment, clean backdrop",
    "产品介绍": "Professional product showcase, clean corporate environment, modern setting",
    "其他": "Contemporary professional setting, clean modern backdrop, neutral aesthetic"
  };

  const sceneStr = typeScene[contentType] || typeScene["其他"];

  return `Professional news graphic design, ${sceneStr}, ${base}, subtle matte finish, refined textures, professional understated trustworthy mood, clean sans-serif headlines. 9:16 vertical format, subtle muted tones, no text overlay`;
}

async function callAI(prompt, maxTokens = 2000) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      model: IMAGE_MODEL,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }]
    });

    const options = {
      hostname: IMAGE_API_URL,
      port: 443,
      path: "/v1/chat/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${IMAGE_API_KEY}`,
        "Content-Length": Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          const result = JSON.parse(data);
          if (result.choices && result.choices[0]?.message?.content) {
            resolve(result.choices[0].message.content.trim());
          } else {
            resolve("");
          }
        } catch (e) {
          resolve("");
        }
      });
    });

    req.on("error", reject);
    req.write(postData);
    req.end();
  });
}

async function generateImage(prompt, outputPath) {
  try {
    const response = await callAI(`${prompt}，图片长宽比9:16`);

    // Extract image URLs from markdown format: ![1](url) or ![image](url)
    const imageMatches = response.matchAll(/!\[.*?\]\((https?:\/\/[^\)]+)\)/g);
    const imageUrls = [...imageMatches].map(m => m[1]);

    if (imageUrls.length > 0) {
      // Download first image
      const imgResponse = await fetch(imageUrls[0]);
      const buffer = await imgResponse.arrayBuffer();
      fs.writeFileSync(outputPath, Buffer.from(buffer));
      return true;
    }
    console.log("   ⚠️  API响应格式错误或无图片");
  } catch (e) {
    console.log(`   ⚠️  请求失败: ${e.message}`);
  }
  return false;
}

function getPlaceholderSvg(palette, keyword) {
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

function splitContent(content, slideCount) {
  content = content.replace(/^口播文案：/, "").trim();
  const paragraphs = content.split(/\n+/).filter(p => p.trim());

  if (slideCount && slideCount > 0) {
    const totalChars = content.length;
    const charsPerSlide = Math.ceil(totalChars / slideCount);

    const slides = [];
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

  const slides = [];
  let currentSlide = "";

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

function generateSvg(slidesContent, topic, generatedImages) {
  const today = new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });

  const slidesHtml = [];
  const slidesData = [];

  for (let idx = 0; idx < slidesContent.length; idx++) {
    const content = slidesContent[idx];
    const palette = PALETTES[idx % PALETTES.length];

    let imgHtml;
    const imagePath = generatedImages.get(idx);
    if (imagePath && fs.existsSync(imagePath)) {
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

async function main(content, topic, slideCount) {
  const today = new Date().toISOString().slice(0, 10);
  const outputDir = path.join(OUTPUT_BASE, today);
  fs.mkdirSync(outputDir, { recursive: true });

  if (!topic) {
    topic = content.slice(0, 30).replace(/\n/g, " ").trim();
    if (content.length > 30) topic += "...";
  }

  console.log(`📁 输出目录: ${outputDir}`);
  console.log(`📝 内容主题: ${topic}`);
  console.log();

  const contentType = detectContentType(content);
  console.log(`🔍 内容类型: ${contentType}`);

  const style = detectStyle(contentType);
  console.log(`🎨 选用风格: ${style}`);
  console.log();

  console.log(`✂️  拆分内容...`);
  const slidesContent = splitContent(content, slideCount || 5);
  console.log(`   拆分数量: ${slidesContent.length}页`);
  for (let i = 0; i < slidesContent.length; i++) {
    const preview = slidesContent[i].slice(0, 50).replace(/\n/g, " ");
    console.log(`   [${i + 1}] ${preview}...`);
  }
  console.log();

  console.log(`🎨 正在生成 ${slidesContent.length} 张配图...`);
  const generatedImages = new Map();

  for (let idx = 0; idx < slidesContent.length; idx++) {
    const slideText = slidesContent[idx];
    console.log(`   [${idx + 1}/${slidesContent.length}] 正在生成配图...`);

    const prompt = buildImagePrompt(style, contentType, slideText);
    console.log(`       提示词: ${prompt.slice(0, 50)}...`);

    const imagePath = path.join(outputDir, `slide-${String(idx + 1).padStart(2, "0")}-image.png`);
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

  const { html, slidesData } = generateSvg(slidesContent, topic, generatedImages);

  const htmlPath = path.join(outputDir, "内容展示.html");
  fs.writeFileSync(htmlPath, html, "utf-8");
  console.log(`   ✅ 已保存: 内容展示.html (${slidesData.length}页)`);

  const mdContent = slidesContent.join("\n\n");
  const mdPath = path.join(outputDir, "播报内容.md");
  fs.writeFileSync(mdPath, mdContent, "utf-8");
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

const content = process.argv[2];
const topic = process.argv[3];
const slideCount = process.argv[4] ? parseInt(process.argv[4]) : undefined;

if (!content) {
  console.log("用法: node generate.js <内容> [主题] [幻灯片数量]");
  process.exit(1);
}

main(content, topic, slideCount).catch(console.error);