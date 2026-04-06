---
name: svg-to-video
description: |
  将用户提供的任意内容（文章、故事、知识点、新闻等）智能拆分成多个幻灯片，并生成移动端友好的SVG幻灯片和配图。使用文生图接口文档提供AI图像生成。当用户说"帮我把这段内容做成幻灯片"或"把这个内容拆成几个部分展示"时触发。
version: 1.3.0
metadata:
  openclaw:
    homepage: https://github.com/JimLiu/baoyu-skills#svg-to-video
    requires:
      anyBins:
        - bun
        - npx
---

# 内容SVG生成器 Skill

将任意内容智能拆分并生成移动端友好的SVG幻灯片，使用文生图接口文档提供AI图像生成。

## Script Directory

**Agent Execution Instructions**:
1. Determine this SKILL.md file's directory path as `{baseDir}`
2. Script path = `{baseDir}/scripts/main.ts`
3. Resolve `${BUN_X}` runtime: if `bun` installed → `bun`; if `npx` available → `npx -y bun`; else suggest installing bun

## 核心变化

- **输入**：用户直接提供内容（不再搜索）
- **拆分**：AI根据内容长度和结构智能拆分为2-10个幻灯片
- **内容类型**：不限，可能是新闻、故事、教学、科普等
- **配图生成**：使用文生图接口文档提供高质量AI图像生成
- **配图风格**：根据内容类型自适应选择风格预设

## 工作流程

### 第一步：解析输入

用户输入可能是：
- 一段长文本
- 一篇文章
- 多个段落
- 指定拆分数量，如"拆成5个幻灯片"

提取 `CONTENT`（内容）和 `SLIDE_COUNT`（可选，指定数量）。

### 第二步：AI智能拆分内容

调用AI将内容智能拆分为多个段落：

**Prompt**：
```
将以下内容拆分成4-10个幻灯片，每个幻灯片是一段简短完整的内容。
要求：
1. 每个幻灯片内容独立完整，适合展示和播报
2. **内容言简意赅，每段控制在80字以内**（这是关键要求）
3. 保留内容原意和结构
4. 直接输出拆分结果，每段用"---SLIDE---"分隔

内容：
<用户内容>

请先说明拆分数量，然后输出拆分结果。
```

解析AI返回结果，提取各个幻灯片内容。

### 第三步：内容类型分析与风格选择

**重要**：配图风格根据内容类型自动适配。

1. 分析内容类型（新闻/故事/教学/科普/知识分享/产品介绍等）
2. 根据内容类型选择对应风格预设

**风格预设映射**：

| 内容类型 | 推荐风格 | 风格描述 |
|---------|---------|---------|
| 新闻 | bold-editorial | 现代数字艺术、简洁抽象、新闻播报风格 |
| 故事 | fantasy-animation | 插画风格、叙事感、情感表达 |
| 教学 | chalkboard | 黑板风格、手写感、教育氛围 |
| 科普 | blueprint | 技术图表、科学可视化 |
| 知识分享 | notion | 简洁几何、清晰易懂 |
| 产品介绍 | corporate | 专业商务、简洁大气 |
| 其他 | bold-editorial | 现代简约、视觉吸引 |

**可用风格预设**：
- `bold-editorial` - 杂志风格、鲜明活泼
- `notion` - 简洁几何、 SaaS/产品感
- `blueprint` - 技术蓝图、建筑图表
- `sketch-notes` - 手绘风格、教育教程
- `watercolor` - 柔和艺术、生活方式
- `corporate` - 专业商务、投资演示
- `minimal` - 极简风格高管简报
- `chalkboard` - 黑板粉笔、课堂教学
- `fantasy-animation` - 奇幻动画、儿童内容
- `dark-atmospheric` - 暗色调、娱乐游戏

### 第四步：生成配图提示词

**重要**：配图提示词必须基于实际内容生成，结合所选风格。

1. 根据内容类型和风格生成贴合的英文图片提示词
2. 提示词结构：
   - 内容类型视觉风格描述
   - 风格预设的视觉维度（texture, mood, typography, density）
   - 具体内容核心场景

**提示词生成逻辑**：
```
[内容类型视觉风格], Style: [texture] texture, [mood] mood, Typography: [typography], Density: [density], [具体内容描述]
```

### 第五步：使用文生图接口生成高质量图像

**API配置**：
- URL: `https://sg2.dchai.cn/v1/chat/completions`
- Model: `Nano_Banana_2_2K_0`
- 图像比例: 9:16

### 第六步：生成SVG幻灯片

生成的SVG幻灯片要求：
- 移动端友好：viewBox="0 0 450 800"（9:16比例）
- 根据播报时长自动翻页
- 首页显示日期和内容主题
- 使用CSS动画实现过渡效果

**SVG结构要求**：
- ViewBox: 0 0 450 800（9:16比例）
- 自动翻页时长：根据内容字符数计算
- 首页：显示日期+主题，格式"YYYY年MM月DD日 [主题]"

**自动翻页SVG生成**：
为每段内容创建一个SVG幻灯片（HTML包装器+SVG页面）

**移动端要求**：
- 宽度: 100vmin（响应式）
- 最大宽度: 450px
- 支持触摸滑动手动导航
- 底部显示进度指示器

### 第七步：生成播报文本

**格式要求**：
- 纯内容，无标题、无来源、无日期、无解释
- 适合抖音/微信视频/快手等平台

**输出格式**：
```
内容段1...

内容段2...

...
```

### 第八步：保存输出

**目录结构**：
```
~/Desktop/内容SVG输出/
└── YYYY-MM-DD/
    ├── 内容展示.html
    ├── 播报内容.md
    ├── slide-01-image.png
    ├── slide-02-image.png
    └── ...
```

**文件名规范**：标题去特殊字符，最多50字

**保存后**：输出完整目录路径

## 环境要求

- Bun 或 npx (用于运行 TypeScript)
- 文生图接口文档 API Key（内置）

## 错误处理

- 如果内容拆分失败，尝试按段落拆分或返回错误
- 如果图像生成失败，使用占位 SVG
- 始终先保存成功生成的文件，再报告完成
