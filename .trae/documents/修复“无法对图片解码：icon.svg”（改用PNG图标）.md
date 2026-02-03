## 问题
- Chrome 扩展的 icons 与 action.default_icon 不支持使用 SVG 作为位图资源，导致安装时报错：无法对图片解码 “icon.svg”。

## 方案
1. 从现有 icons/icon.svg 导出 PNG 图标（透明背景），生成多尺寸：128、48、32、16。
2. 使用系统工具在本机转换：
   - 先用 qlmanage 从 SVG 导出高分辨率 PNG
   - 再用 sips 生成 16/32/48 派生图
3. 更新 manifest.json：
   - action.default_icon → 指向 icons/icon-16.png、icon-32.png
   - icons → 指向 icons/icon-16.png、icon-32.png、icon-48.png、icon-128.png
4. 验证：重新加载扩展，确认不再报错，图标清晰渲染。

## 注意
- 仅替换清单中的位图路径，不改动 UI 内嵌的 SVG 使用。
- 如需更高清版本，可保留 128 为基础，再生成 256/512 以适配商店预览。