## 目标
- 生成符合 Chrome 扩展打包要求的私钥（PEM/RSA 2048）。
- 使用该私钥打包扩展，确保扩展 ID稳定（由公钥派生）。
- 私钥安全存放，不纳入代码仓库。

## 私钥生成（OpenSSL）
- 推荐使用 RSA 2048 位：
  - 方式一（通用）：
    - bash: `openssl genrsa -out fast-bookmark-key.pem 2048`
  - 方式二（新式接口）：
    - bash: `openssl genpkey -algorithm RSA -out fast-bookmark-key.pem -pkeyopt rsa_keygen_bits:2048`
- 产物：`fast-bookmark-key.pem`（PEM 格式，包含私钥）。
- 存放建议：例如 `~/Secrets/fast-bookmark/fast-bookmark-key.pem`，并建立备份。

## 打包方式A：Chrome 图形界面
1. 打开 Chrome → 扩展程序（chrome://extensions）
2. 开启“开发者模式”
3. 点“打包扩展程序”
4. 扩展根目录选择：`/Users/pandegong/my-project/fast-bookmark`
5. 私钥文件选择：`fast-bookmark-key.pem`
6. 生成 `.crx` 与（如未提供私钥）`.pem`，使用已有私钥则仅生成 `.crx`

## 打包方式B：命令行（可选）
- macOS 示例：
  - `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome --pack-extension=/Users/pandegong/my-project/fast-bookmark --pack-extension-key=/path/to/fast-bookmark-key.pem`
- 输出：同目录生成 `.crx`（打包文件）与可能的 `.pem`（若未提供）。

## 验证与注意事项
- 扩展ID稳定性：使用同一私钥打包得到同一扩展 ID；更换私钥会改变 ID。
- 私钥安全：
  - 不提交到仓库；将路径加入 `.gitignore`
  - 仅本机/安全密钥管理工具保存，并做离线备份
- 加载测试：
  - 在 chrome://extensions → “加载已解压的扩展程序”用于开发调试
  - 使用 `.crx` 分发测试（本地安装需要允许来自开发者的扩展）

## 可选增强
- 生成多环境密钥（生产/测试），分别打包对应渠道；妥善管理不同密钥避免混用。
- 若需在其他Chromium浏览器（Edge/Brave）打包，流程相同，命令路径不同。

## 下一步
- 我可按以上步骤为你生成私钥（在本机安全位置）并提供打包命令；或指导你在目标机器上执行，确保密钥不离开你的设备。