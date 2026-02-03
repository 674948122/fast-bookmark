## 图标设计
- 主题：简洁、现代的 5 角星，主色为金黄（亮面渐变+浅投影）。
- 颜色：
  - 渐变：浅金 #FDE68A → 主金 #F59E0B → 深金 #B45309
  - 轮廓：#B45309（提高暗背景下的清晰度）
- 效果：轻微投影（feDropShadow），保证在 Chrome 工具栏与商店页面均清晰。

## 资产产出
- SVG（矢量主文件）：icons/icon.svg（viewBox=0 0 128 128，包含线性渐变与投影滤镜）。
- PNG 导出（保证跨浏览器与商店预览）：
  - icons/icon-16.png、icon-32.png、icon-48.png、icon-128.png（由 SVG 导出，居中填充，透明背景）。

## Manifest 更新
- 更新图标映射：
  - icons: {"16": "icons/icon-16.png", "32": "icons/icon-32.png", "48": "icons/icon-48.png", "128": "icons/icon-128.png"}
- 更新工具栏图标：
  - action.default_icon：使用 16/32 PNG（保留现有标题与其他字段）。

## 具体实现步骤
1. 新增 icons/icon.svg：
   - 线性渐变 goldGradient（#FDE68A→#F59E0B→#B45309），星形 polygon 路径，stroke=#B45309，filter=feDropShadow。
2. 从 SVG 导出 PNG（16/32/48/128），命名如上。
3. 修改 manifest.json 的 icons 与 action.default_icon 指向 PNG 资源。
4. 检查扩展加载与工具栏展示：确认清晰无锯齿，深浅主题下均可辨识。

## 验证
- 重新加载扩展：工具栏与扩展管理页显示为黄色五角星。
- 在 Retina 屏下检查 16/32 像素渲染效果是否清晰；商店预览使用 128。

## 备注与可选项
- 若需要暗/亮两套对比更强的版本，可额外提供描边加粗或高光更强的 SVG 变体。
- 如希望更卡通或扁平风格，可替换为纯色（#F59E0B）+白色描边方案。