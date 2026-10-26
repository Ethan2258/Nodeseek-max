# 开发指南

[返回首页](../README.md) · [贡献说明](../CONTRIBUTING.md) · [上游维护](../upstream/README.md)

## 环境与初始化

推荐 Node.js 24（CI 使用同一主版本），最低 Node.js 22。云端运行环境固定为 Ubuntu 24.04，避免 latest 镜像迁移改变依赖安装环境。首次克隆后：

```bash
npm ci
npx playwright install chromium webkit
npm run check
```

Linux 安装浏览器系统依赖时可用 `npx playwright install --with-deps chromium webkit`。本地使用已有 Chrome / Edge 时，环境变量 `NSMAX_CHROMIUM` 可指定可执行文件；WebKit 专项仍需安装 Playwright WebKit。

依赖与传递依赖由 package-lock.json 锁定。普通开发用 npm ci；只有主动调整依赖时才更新锁文件，并检查差异。

## 目录与修改入口

| 位置 | 用途 |
| --- | --- |
| nodeseek-max.user.js | 可安装源码、元数据及论坛核心模块；包含构建注入的主题与 UI 块 |
| theme/ui-runtime.js | 主题界面整理、编辑器和手机侧栏逻辑；对应脚本中的 SB_RUNTIME 块 |
| theme/design.css | 最后覆盖的主题规则，包含响应式适配 |
| theme/mobile.css | iPhone 触屏、手机菜单与 Safari 适配，按顺序接在设计层后构建 |
| theme/sb-mobile-reference.json | 实测 sb.sb 圆角手机版的样式来源、尺寸、圆角与适配差异 |
| theme/sb-adapter.css | 原站结构与主题之间的适配 |
| theme/messages.css / settings.css | 消息中心、设置面板样式 |
| theme/source.js | 主题基底及构建维护的样式内容；仅修改基底时直接编辑，构建更新的部分保留生成结果 |
| theme/sb-suite.css / sb-reference.json | 主题参考快照与来源记录 |
| scripts | 构建、校验、压缩、发布说明和上游检查 |
| tests | 浏览器回归、测试工具、模拟页面、截图和性能比较 |
| upstream | 已合并上游的原始基线，不直接作为本地功能实现 |
| docs/screenshots | 文档展示图片；完整审查输出放在忽略的 docs/validation 中 |

不要在 user.js 的 SB_RUNTIME_START / END 块或生成的 CSS 字符串内直接改 UI；修改 theme 中对应源文件，再运行构建。其他核心模块仍在 user.js 中维护。

## 构建与检查

```bash
npm run build
npm run check
npm run minify -- --out dist/nodeseek-max.user.js
```

check 验证版本、锁文件、本地文档链接、脚本语法、主题构建与 meta 一致性。构建结果与源码一起提交；dist 是忽略的本地发布产物。

主题构建会检查分块前后规则顺序和声明一致性，也会拒绝未处理的 :has()。新增结构条件优先通过运行时属性标记表达，避免在大页面上增加昂贵的选择器。

## 测试

| 命令 | 覆盖 |
| --- | --- |
| npm test | 所有浏览器回归 |
| npm run test:smoke | 页面、编辑、功能和性能相关回归 |
| npm run test:settings | 设置操作、持久化、开关与输入校验 |
| npm run test:mobile | Chromium / WebKit 的 iPhone 触屏布局与操作 |
| npm run test:userscripts | 异步 GM API、失败重试、隔离世界编辑与原生回退 |
| npm run test:lottery | 长网址预览、表格边界与开奖链接参数 |

设置 `NSMAX_SCRIPT_PATH` 可用同一套测试验证压缩文件。CI 将源码和压缩产物放在两个并行任务中，二者都成功后，统一 test 检查才通过。

模拟页面由 tests/fixtures 提供。修复功能问题时优先增加能复现用户操作的回归，避免只检查实现字符串；关闭功能后的行为也应覆盖。

## 截图与性能比较

```bash
npm run screenshots
npm run performance
npm run performance -- --baseline=v1.8.46
```

截图默认输出到 docs/validation；`NSMAX_AUDIT_DIR` 可指定目录，`NSMAX_AUDIT_ENGINE=webkit` 可使用 WebKit，`NSMAX_AUDIT_PAGES=home,post` 可缩小页面范围。手机截图使用触屏配置与原生手机结构。

性能脚本默认与 HEAD 比较，也可指定本地可解析的 Git 提交或标签；不依赖固定的历史版本。使用相同模拟页面、浏览器和采样窗口，各跑三次取中位数。结果用于本地比较，不代表论坛服务器、网络或真机速度；相同比较对象仍可能存在测量噪声。

## 发布

1. 同步脚本 @version、NSMAX_VERSION、package.json 与锁文件版本，在 CHANGELOG.md 顶部写当前版本说明。
2. 运行 build、check 和相关测试，检查生成差异与更新截图。
3. 推送或合并到 main；CI 完整测试源码与压缩包。
4. CI 成功后，Release 工作流从该 CI 的提交构建，创建版本标签与安装附件；已有标签会跳过。
5. 核对标签提交、版本与附件哈希。不要用手动发布绕过失败的 CI。

Release 使用锁文件和与 CI 相同的 Node.js 主版本。上游检查只报告与登记基线的差异，不会自动移植代码。
