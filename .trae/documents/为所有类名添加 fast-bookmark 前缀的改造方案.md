## 目标
- 为内容脚本中所有 CSS 类名统一添加 fast-bookmark 前缀，避免与网页样式冲突（重点覆盖 .result-item 及关联结构）。

## 命名约定
- 类名前缀：fast-bookmark-
- 示例映射：
  - result-item → fast-bookmark-result-item
  - selected → fast-bookmark-selected
  - tree-node → fast-bookmark-tree-node
  - folder-toggle → fast-bookmark-folder-toggle（及 expanded → fast-bookmark-expanded）
  - folder-icon → fast-bookmark-folder-icon
  - node-content → fast-bookmark-node-content
  - indent → fast-bookmark-indent
  - result-info → fast-bookmark-result-info
  - result-header → fast-bookmark-result-header
  - result-path → fast-bookmark-result-path
  - result-title → fast-bookmark-result-title
  - result-url → fast-bookmark-result-url
  - favicon → fast-bookmark-favicon
  - highlight → fast-bookmark-highlight
  - key-hint → fast-bookmark-key-hint
  - key-cap → fast-bookmark-key-cap
  - 宿主态类名：fb-searching → fast-bookmark-searching（:host 与 JS 同步）

## 修改范围
- 样式模板：更新所有选择器为前缀类（含状态选择器 selected/expanded）
  - 位置：[updateStyles 样式模板](file:///Users/pandegong/my-project/fast-bookmark/content.js#L41-L350)
- DOM 构建：修改赋值的 className 与 innerHTML 中的类名
  - 树视图渲染：[renderNode](file:///Users/pandegong/my-project/fast-bookmark/content.js#L455-L538)
  - 搜索结果渲染：[doRender](file:///Users/pandegong/my-project/fast-bookmark/content.js#L540-L629)
  - 复制提示依赖的选择器（.result-title）同步调整
- 搜索态宿主类：container.classList.* 从 fb-searching 改为 fast-bookmark-searching
  - 输入事件与关闭逻辑位置：[searchInput/input](file:///Users/pandegong/my-project/fast-bookmark/content.js#L699-L709)、[toggle 关闭](file:///Users/pandegong/my-project/fast-bookmark/content.js#L678-L688)
  - 滚动持久化的态判断同步修改：[scroll 监听](file:///Users/pandegong/my-project/fast-bookmark/content.js#L732-L747)

## 兼容与验证
- 蓝湖等站点打开后，检查 .fast-bookmark-result-item 的排版、hover、selected 状态正常；
- 搜索与树视图两种渲染均使用前缀类，复制提示正常；
- 主题与持久化逻辑不受影响（仅类名变更）。

## 执行步骤
1. 全量替换样式模板中的类选择器为前缀形式；
2. 替换 renderNode/doRender 中的 className 与 innerHTML 的类名；
3. 将宿主态类名统一为 fast-bookmark-searching 并同步判断；
4. 自测在蓝湖与常见站点，确认样式稳定。