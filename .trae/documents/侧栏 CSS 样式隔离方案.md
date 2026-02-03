## 目标
- 避免页面样式影响书签侧栏，解决在蓝湖等站点出现的样式错乱。

## 隔离策略
- 主动避免页面全局类名冲突：将 :host(.searching) 与 JS 中的 'searching' 类改为前缀类 'fb-searching'。
- 提升容器自身样式稳健性：为宿主容器设置内联定位与层级（position: fixed; z-index 极高），不依赖外部 styles.css。
- 在侧栏内自给自足：继续使用 Shadow DOM 内样式，确保结构与配色变量仅在 Shadow 内生效。

## 代码修改点
- 样式模板：将 :host(.searching) 改为 :host(.fb-searching)。
- JS 行为：所有 container.classList.add/remove('searching') 更名为 'fb-searching'。
- 容器创建时：为 #fast-bookmark-container 设置 position: fixed; top/left: 0; zIndex: 2147483647。

## 验证
- 在蓝湖等站点打开侧栏，检查空状态、搜索态、树视图样式均不受页面 CSS 干扰。
- 常规站点页面同样表现正常；搜索态切换无异常。