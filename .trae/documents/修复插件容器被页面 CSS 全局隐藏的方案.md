**问题分析**
- 页面使用选择器 `body > *:not(#bewly):not(script):not(style):not(.bili-header):not(.custom-navbar)` 强制对 body 的直接子元素设置隐藏与禁用（display/visibility/pointer-events/position/left），并且都带有 `!important`。
- 我们的插件宿主节点是 body 的直接子元素 [content.js:L25-L33](file:///Users/pandegong/my-project/fast-bookmark/content.js#L25-L33)，因此会被上述规则命中，即使 Shadow DOM 内部样式不被外部影响，宿主节点仍会被隐藏。
- 现有代码用 `element.style.xxx = '... !important'` 设置内联样式，但这是无效写法；需要使用 `style.setProperty(prop, value, 'important')` 才能正确生效。同时在显示时仅设置了 `display = 'block'`，未带 `!important`，会被页面规则覆盖。

**改动方案**
- 在创建容器时，统一用 `setProperty` 设定基础样式并带 `!important`：
  - `display: none`、`position: fixed`、`top/left: 0`、`z-index: 2147483647`、`visibility: hidden`、`pointer-events: none`。
- 在 `toggle(true)` 显示时，强制覆盖页面规则：
  - 设置 `display: block !important`、`visibility: visible !important`、`pointer-events: auto !important`、`position: fixed !important`、`left: 0 !important`、`top: 0 !important`、并维持高 `z-index`。
- 在 `toggle(false)` 隐藏时，对上述属性同样用 `setProperty(..., 'important')` 恢复为不可见状态，避免被页面规则干扰。
- 提升鲁棒性（可选）：若页面存在白名单容器，则挂载到其内部以绕过 `body > *` 选择器：
  - 优先查找 `#bewly`，否则查找 `.bili-header` 或 `.custom-navbar`；找到则在该节点下 `appendChild(container)`，否则仍挂载到 `document.body`。
- 站点兼容（可选）：若检测到 `location.hostname` 包含 `bilibili.com`，可为宿主添加白名单标识以直接避开选择器（例如 `container.classList.add('custom-navbar')`），同时仍保留强制样式以防该类被站点其他样式影响。

**具体修改位置**
- 创建容器与挂载：[content.js:L25-L33](file:///Users/pandegong/my-project/fast-bookmark/content.js#L25-L33)
  - 替换所有 `container.style.xxx = '... !important'` 为 `container.style.setProperty(...)`。
  - 新增白名单宿主检测与挂载逻辑（`#bewly` / `.bili-header` / `.custom-navbar`）。
- 显示/隐藏逻辑：[toggle 函数 content.js:L707-L740](file:///Users/pandegong/my-project/fast-bookmark/content.js#L707-L740)
  - 在显示与隐藏分支中，分别用 `setProperty(..., 'important')` 设置 `display/visibility/pointer-events/position/top/left/z-index`。

**示例代码片段（核心要点）**

```js
// 初始化：强制基础样式
container.style.setProperty('display', 'none', 'important');
container.style.setProperty('position', 'fixed', 'important');
container.style.setProperty('top', '0', 'important');
container.style.setProperty('left', '0', 'important');
container.style.setProperty('z-index', '2147483647', 'important');
container.style.setProperty('visibility', 'hidden', 'important');
container.style.setProperty('pointer-events', 'none', 'important');

// 可选：白名单挂载
const allowHost = document.getElementById('bewly') || document.querySelector('.bili-header, .custom-navbar');
(allowHost || document.body).appendChild(container);

// toggle(true)：显示时强制覆盖
container.style.setProperty('display', 'block', 'important');
container.style.setProperty('visibility', 'visible', 'important');
container.style.setProperty('pointer-events', 'auto', 'important');
container.style.setProperty('position', 'fixed', 'important');
container.style.setProperty('top', '0', 'important');
container.style.setProperty('left', '0', 'important');
container.style.setProperty('z-index', '2147483647', 'important');

// toggle(false)：隐藏时恢复
container.style.setProperty('display', 'none', 'important');
container.style.setProperty('visibility', 'hidden', 'important');
container.style.setProperty('pointer-events', 'none', 'important');
```

**验证方案**
- 在存在该全局隐藏规则的页面（如 B 站）打开插件：
  - 宿主节点未被隐藏；侧栏正常出现、可交互；滚动与搜索可用。
- 在普通站点测试：正常显示与隐藏；不受页面样式影响。
- 手动移除白名单节点后再次测试：依靠 `setProperty(..., 'important')` 仍可正常显示，验证鲁棒性。

确认后我将按上述计划修改 content.js 并进行本地验证。