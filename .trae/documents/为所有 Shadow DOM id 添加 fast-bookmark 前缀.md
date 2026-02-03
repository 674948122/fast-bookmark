## 目标
- 为 content.js 中 Shadow DOM 的所有 id 添加统一前缀 fast-bookmark-，避免潜在与网页内元素冲突。
- 同步更新：样式选择器、HTML 模板、元素获取与事件绑定。

## 涉及 id（重命名映射）
- overlay → fast-bookmark-overlay
- modal → fast-bookmark-modal
- sidebar-header → fast-bookmark-sidebar-header
- sidebar-title → fast-bookmark-sidebar-title
- settings-btn → fast-bookmark-settings-btn
- search-container → fast-bookmark-search-container
- search-input-wrapper → fast-bookmark-search-input-wrapper
- search-input → fast-bookmark-search-input
- search-icon → fast-bookmark-search-icon
- results-list → fast-bookmark-results-list
- empty-state → fast-bookmark-empty-state
- footer → fast-bookmark-footer

## 修改点
1. 样式模板：将所有 #id 选择器替换为 #fast-bookmark-...（含 ::-webkit-scrollbar 等伪元素、组合选择器，如 #overlay.visible #modal）。
2. HTML 结构：在 overlay.innerHTML 中将所有 id 替换为新前缀；overlay.id 改为 fast-bookmark-overlay。
3. JS 逻辑：shadow.getElementById 全部改为新 id；settingsBtn、searchInput、resultsList、emptyState 的引用保持变量名不变。

## 验证步骤
- 重新加载扩展，打开侧栏：交互正常（搜索、树视图、主题切换）。
- 检查样式（滚动条、悬停、选中态）仍正确应用。
- 控制台无查询不到元素或样式异常。

## 风险与回滚
- 仅限 Shadow DOM 内部，风险低；若出现问题，按映射表逆向还原即可。