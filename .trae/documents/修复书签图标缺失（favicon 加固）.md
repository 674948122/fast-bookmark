## 问题与定位
- favicon 加载点：
  - 目录树项：[content.js:L508-L515](file:///Users/pandegong/my-project/fast-bookmark/content.js#L508-L515)
  - 搜索结果项：[content.js:L619-L626](file:///Users/pandegong/my-project/fast-bookmark/content.js#L619-L626)
- 当前逻辑：先用 `chrome-extension://<id>/_favicon/?pageUrl=...&size=32`，失败后 `onerror` 改为 `https://www.google.com/s2/favicons?domain=...`。
- 可能导致某些图标不显示：
  - 非 http/https 书签（如 chrome://、edge://、file://、data:、blob:）导致 `new URL(...)` 抛错，`onerror` 回退链中断。
  - 页面 CSP 限制 `img-src`，阻止从 `chrome-extension://` 或 `https://www.google.com` 加载外部图片。
  - 目标页面无 favicon 或服务返回空白。

## 修改方案
1. 统一安全回退链：
   - 首选 `_favicon`（扩展内部服务）。
   - 二选 `Google S2`（仅限 http/https）。
   - 终极回退：使用内联 SVG 图标（不走网络、规避 CSP 外源限制）。
2. 健壮性增强：
   - 在 `onerror` 中对 `new URL(...)` 包 try/catch，避免异常中断。
   - 根据 URL scheme 判断：
     - http/https → 允许 S2 回退
     - chrome://、edge://、about:、file://、data:、blob: → 直接使用内联 SVG（如通用网页/文件图标）。
3. 代码复用：新增一个小型工具函数 `setFavicon(el, url)` 封装上述回退链，供树视图与搜索结果复用。

## 具体改动点
- 在 [content.js](file:///Users/pandegong/my-project/fast-bookmark/content.js)：
  - 顶部新增 `setFavicon(imgEl, pageUrl)` 函数：
    - 设置 `_favicon` 源；绑定 `onerror`。
    - `onerror` 中：try/catch 解析 URL；http/https 切换至 S2；否则替换为内联 SVG 元素（移除 imgEl，插入 `<svg>`）。
    - 若 S2 再失败：同样改为内联 SVG。
  - 将两处创建 favicon 的代码改为调用 `setFavicon(favicon, node.url/item.url)`。
- 选择的内联 SVG：采用现有风格的小图标（例如当前的文件/文件夹 icon 视觉风格，18×18），保证主题色与样式一致。

## 验证步骤
- 在含有以下类型书签到侧栏和搜索中分别检查：
  - 普通 http/https（应显示站点 favicon）
  - 无 favicon 的小站（应显示内联占位图）
  - chrome:// 与 file://（应显示内联占位图）
  - CSP 严格站点页面内打开（不应被外部源拦截，内联 SVG 正常显示）
- 打开 DevTools：确认无未捕获异常；`onerror` 路径命中后正确回退。

## 风险与回滚
- 改动仅限 content 脚本局部逻辑，风险低。
- 若需要恢复，删除 `setFavicon` 并还原原始两处 favicon 设置即可。