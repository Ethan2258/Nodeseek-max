# NodeSeek Max

NodeSeek / DeepFlood 用户脚本，当前版本 `1.7.2`。采用 [SB Theme UI](https://sb.sb/) 套件，并适配 NodeSeek 的原生页面和交互。

## 安装

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 或 Violentmonkey。
2. 安装最新版：[nodeseek-max.user.js](https://raw.githubusercontent.com/Ethan2258/Nodeseek-max/main/nodeseek-max.user.js)。
3. 停用旧的 NodeSeek 增强脚本，避免重复注入。

只需要样式时，可用 [Stylus](https://add0n.com/stylus.html) 安装 [独立 CSS](https://raw.githubusercontent.com/Ethan2258/Nodeseek-max/main/theme/nodeseek-max.user.css)。完整版本和历史文件见 [Releases](https://github.com/Ethan2258/Nodeseek-max/releases)。

## 当前界面

- 顶栏、搜索、版块导航、分页、按钮、输入框和图标统一使用套件组件规则。
- 首页使用 1200px 内容容器、260px 侧栏、20px 间距、12px 卡片、分隔行帖子列表和胶囊控件。
- 帖子页保留原生回复输入框、内容/预览切换、引用与提交，主楼和回复使用同一套排版与线条图标。
- `/notification` 使用套件标签、消息列表和私信布局；`/setting` 使用真实 `#user-setting-panel` 的分组表单布局。
- 浅色和深色都使用 SB Theme UI 官方 Token；默认系统字体，不联网下载字体。
- 统一使用套件的短时长过渡、抽屉/弹窗进入和减少动画支持，按页面类型尽早启动必要逻辑。

## 保留功能

- 外链中转页直达和 NodeSeek `/jump` 跳转。
- 关键词、用户和等级过滤。
- 黑名单通知过滤。
- 帖子自动翻页、正文排版、代码复制、图片预览和编辑器增强。
- SB 桌面个人卡：四项真实统计、两列功能链接和卡片内发帖入口；今日热门为单行十条日榜，按需请求并复用缓存。
- 通知、原生私信列表与会话、主题切换和搜索面板适配。脚本设置按需打开，仅显示当前分类，保存时保留其他页面设置。

信用分及作者资料批量请求已移除。阅读历史、帖子监控、回帖足迹、NQ 快捷入口、旧工具条、手机悬浮回复和旧消息中心编辑器不启动；底部相关网站/站内导航/商业推广等链接组隐藏。

## 开发

```bash
npm install --no-package-lock
npm run check     # 语法、meta、独立 CSS
npm test          # 功能与手机布局回归
npm run sb        # 编译套件、适配层和运行时主题
npm run screenshots # 浅色/深色/手机截图及加载指标
npm run performance # 同一 fixture 对比 v1.7.1 与当前脚本，三次中位数
npm run meta      # 生成 nodeseek-max.meta.js
npm run css       # 生成 theme/ 下的独立 CSS
```

测试需要 Chromium。已有 Chrome 时可指定：

```powershell
$env:NSMAX_CHROMIUM="C:\Path\To\chrome.exe"
npm test
```

套件快照在 `theme/sb-suite.css`，站点适配在 `theme/sb-adapter.css`，设置面板在 `theme/settings.css`，桥接源在 `theme/source.js`。构建时裁剪无用规则并优化选择器。输入期间不触发全页增强扫描；默认系统字体，不加载演示内容或重复编辑器库。原生接口、验证码及权限检查由站点处理。

## 许可证

GPL-3.0-only，见 [LICENSE](LICENSE)。项目基于 NodeSeek++，并整合外链跳转、黑名单通知过滤等开源组件；第三方许可证声明保留在脚本头部。
