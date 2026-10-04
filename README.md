# NodeSeek Max

NodeSeek / DeepFlood 用户脚本，当前版本 `1.7.0`。界面基于 [SB Theme UI](https://sb.sb/) 设计套件重做，保留 NodeSeek 的数据和交互能力，并针对真实页面结构适配首页、帖子、通知和设置页面。

## 安装

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 或 Violentmonkey。
2. 安装最新版：[nodeseek-max.user.js](https://raw.githubusercontent.com/Ethan2258/Nodeseek-max/main/nodeseek-max.user.js)。
3. 停用旧的 NodeSeek 增强脚本，避免重复注入。

只需要样式时，可用 [Stylus](https://add0n.com/stylus.html) 安装 [独立 CSS](https://raw.githubusercontent.com/Ethan2258/Nodeseek-max/main/theme/nodeseek-max.user.css)。完整版本和历史文件见 [Releases](https://github.com/Ethan2258/Nodeseek-max/releases)。

## 当前界面

- 顶栏、搜索、版块导航、分页、按钮和输入框采用 SB Theme UI 组件规则。
- 首页使用 1200px 单栏内容区、白色主卡片、分隔行帖子列表、方形头像和分类标签。
- 帖子页使用主楼、正文、代码块、表格、回复流和操作按钮布局。
- `/notification` 使用通知标签和列表卡片布局。
- `/setting` 使用单栏分组设置布局。
- 浅色、深色、跟随系统使用同一套设计 Token；系统字体默认，无需联网下载字体。
- 动效使用短时长、无回弹过渡，页面按区域尽早显示，减少刷新跳动。

## 保留功能

- 外链中转页直达和 NodeSeek `/jump` 跳转。
- 关键词、用户和等级过滤。
- 黑名单通知过滤。
- 帖子自动翻页、正文排版、代码复制、图片预览和编辑器增强。
- 用户等级、注册天数和信任信息缓存与按需加载。
- 设置面板、主题切换、搜索面板和消息相关页面适配。

以下模块按当前界面目标默认移除，不再进入启动链或插入页面：阅读历史、帖子监控、回帖足迹、热榜、NQ 快捷入口、旧快捷入口、右侧用户资料卡、右下角工具条、手机悬浮回复和通知页消息中心编辑器。帖子正文和必要的回复列表仍然保留。

## 开发

```bash
npm install --no-package-lock
npm run check     # 语法、meta、独立 CSS
npm test          # v1.7.0 核心 smoke 测试
npm run meta      # 生成 nodeseek-max.meta.js
npm run css       # 生成 theme/ 下的独立 CSS
```

测试需要 Chromium。已有 Chrome 时可指定：

```powershell
$env:NSMAX_CHROMIUM="C:\Path\To\chrome.exe"
npm test
```

主题套件 CSS 已内置到脚本，不依赖运行时外链资源。版本号同步于 `package.json`、用户脚本头部、`NSMAX_VERSION`、meta 和 `CHANGELOG.md`。

## 许可证

GPL-3.0-only，见 [LICENSE](LICENSE)。项目基于 NodeSeek++，并整合外链跳转、黑名单通知过滤等开源组件；第三方许可证声明保留在脚本头部。
