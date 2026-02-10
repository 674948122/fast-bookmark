# Fast Bookmark - 悬浮书签

<p align="center">
  <img src="icons/icon-128.png" alt="Fast Bookmark Icon" width="128" height="128">
</p>

Fast Bookmark 是一款现代化的 Chrome 扩展程序，通过快捷键或点击图标唤起一个悬浮在网页之上的侧边栏，让你无需显示浏览器原生书签栏，也能快速浏览、搜索和管理你的书签。它设计精美，支持暗色模式，并且完全不挤压你的网页可视空间。

## ✨ 核心特性

- **侧边栏设计**：悬浮式侧边栏，用完即走，最大化网页浏览区域。
- **树状目录**：完整的书签树状结构展示，支持文件夹折叠/展开，状态自动记忆。
- **高性能搜索**：
  - 基于 Fuse.js 的模糊搜索，支持标题和 URL 匹配。
  - 搜索结果高亮显示匹配字符。
  - 一键清除搜索框。
- **全面的书签管理**：
  - **编辑**：修改书签名称，更改所属文件夹（支持移动书签）。
  - **删除**：安全删除书签或文件夹（包含二次确认）。
- **个性化设置**：
  - **主题切换**：支持 浅色 / 深色 / 跟随系统自动切换。
  - **位置布局**：支持配置侧栏从 **左侧** 或 **右侧** 弹出。
  - **外观定制**：可调节侧栏宽度、自定义高亮颜色。
  - **快捷键**：支持自定义全局快捷键（默认 `Cmd+B` 或 `Ctrl+B`）快速唤起。
- **国际化支持**：完美支持简体中文和英语 (English)。
- **样式隔离**：使用 Shadow DOM 技术，扩展样式绝不污染原网页。

## 🚀 安装指南

### 方式一：从 Chrome 网上应用店安装（即将上线）
*敬请期待...*

### 方式二：手动加载（开发者模式）
1. 下载本项目代码或 Release 包到本地并解压。
2. 打开 Chrome 浏览器，在地址栏输入 `chrome://extensions/` 并回车。
3. 打开右上角的 **“开发者模式”** 开关。
4. 点击左上角的 **“加载已解压的扩展程序”**。
5. 选择本项目所在的文件夹（包含 `manifest.json` 的目录）。

## 📖 使用手册

### 1. 唤起与关闭
- **快捷键**：按下 `Cmd+B` (Mac) 或 `Ctrl+B` (Windows) 快速唤起。
- **点击图标**：点击浏览器工具栏上的 Fast Bookmark 图标。
- **关闭**：点击侧栏外的任意区域、按下 `Esc` 键或再次按下快捷键。

### 2. 搜索与浏览
- 侧栏顶部搜索框输入关键词，实时展示匹配结果。
- 无搜索内容时展示完整的书签树。
- 点击文件夹左侧箭头可折叠/展开目录。

### 3. 操作书签
- **打开**：点击书签将在新标签页打开。
- **编辑**：鼠标悬停在书签上，点击右侧 **铅笔图标**，可重命名或移动文件夹。
- **删除**：鼠标悬停在书签上，点击右侧 **垃圾桶图标**，确认后删除。
- **复制链接**：按住 `Alt` 键并点击书签，可直接复制链接到剪贴板。

### 4. 设置
点击侧栏顶部的 **齿轮图标** 进入设置面板，你可以：
- 录制自定义快捷键。
- 调整侧栏宽度（300px - 800px）。
- 切换侧栏出现位置（左/右）。
- 自定义明亮/暗黑模式下的高亮颜色。

## 🛠️ 技术栈

- **Manifest V3**：符合 Chrome 扩展最新规范，更安全、性能更好。
- **Vanilla JS**：无大型框架依赖，轻量级，启动速度快。
- **Shadow DOM**：确保插件 UI 样式与宿主网页完全隔离。
- **Fuse.js**：提供强大的前端模糊搜索能力。

## 📝 许可证

MIT License

## 🌟 Star History

<a href="https://star-history.com/#674948122/fast-bookmark&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=674948122/fast-bookmark&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=674948122/fast-bookmark&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=674948122/fast-bookmark&type=Date" />
 </picture>
</a>
