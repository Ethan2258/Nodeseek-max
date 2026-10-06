# NodeSeek Max

NodeSeek / DeepFlood 用户脚本，当前版本 **1.7.9**。使用 [SB Theme UI](https://sb.sb/) 的配色、系统字体、布局和短时过渡，保留论坛原生编辑与提交。

## 安装

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 或 Violentmonkey。
2. [安装最新版脚本](https://raw.githubusercontent.com/Ethan2258/Nodeseek-max/main/nodeseek-max.user.js)。
3. 停用其他 NodeSeek 增强脚本，避免重复注入。

[版本与安装文件](https://github.com/Ethan2258/Nodeseek-max/releases) · [独立 Stylus 样式](https://raw.githubusercontent.com/Ethan2258/Nodeseek-max/main/theme/nodeseek-max.user.css)

## 当前功能

- 全站 SB 样式，统一浅色、深色、字体、按钮、输入框、图标和弹窗。
- 首先呈现当前页主题、过滤和编辑器，再启动热榜与其他增强；输入时不重复扫描整页。
- 桌面个人卡、八个快捷入口、紧凑今日热门、本地最近浏览十条，以及纯文字 NQ 入口。
- 个人空间使用统一的资料头部、四列统计、等级进度条和主题/评论列表分页。
- 帖子列表不自动翻页；评论默认按需追加，更新底部圆形页码，当前页明确引用整理为楼中楼；评论操作在右上角，保留图标和计数。
- 回复与发帖统一 SB 编辑器，保留 Markdown、附件、表情、预览和粘贴图片；预览不留下空编辑器，提交仍由原站处理。
- 发帖页编辑器提供“抽奖”快捷模板，一键填入抽奖标题与开奖信息字段；内容仍需手动检查，发布后的帖子链接再补到开奖链接字段。
- 追加评论优先复用兼容的原生互动组件；不兼容时，互动入口打开该评论原页。
- 通知与私信使用统一消息中心，列表先加载一页，通知正文按点击加载。
- 保留外链直达、关键词过滤、黑名单通知过滤与代码复制。顶栏支持关键词及深浅色切换。
- 深浅色支持浅色、深色和跟随系统；跟随系统只响应操作系统主题，不会被站点自己的主题类突然覆盖。
- 脚本设置按需创建，恢复完整分类、搜索、开关、选项、保存刷新、恢复默认、清空缓存、导入导出配置、关于和检查更新；设置窗口与页面共用 SB Theme UI 的卡片、控件、间距和动效。

头像悬停显示唯一资料卡，单个用户信息按需读取并缓存；个人空间、预览卡和搜索/主题切换均统一适配。

移除信用分、信任分、注册天数、旧阅读历史模块、帖子监控、回帖足迹、重复资料卡及旧工具条；不提供配置导入导出。默认使用本机系统字体，不下载网页字体。

## 开发

```bash
npm install --no-package-lock
npm run sb           # 编译套件、适配样式和界面桥接
npm run css
npm run meta
npm run check
npm test
npm run screenshots  # 桌面浅色、深色与手机布局
npm run performance  # 与 v1.7.2 比较本地 fixture，三次中位数
```

测试需要 Chromium；可通过 `NSMAX_CHROMIUM` 指向已有 Chrome。实际 SB 样式核对记录在 `theme/sb-reference.json`；套件快照在 `theme/sb-suite.css`，适配在 `theme/sb-adapter.css`，回复与分页桥接在 `theme/ui-runtime.js`，消息与关于弹窗样式在 `theme/messages.css`、`theme/settings.css`。

浏览器回归使用真实结构的本地模拟页面；耗时数据不能代表论坛服务器或用户网络速度。原生接口、验证码和权限由站点处理。

## 许可证

GPL-3.0-only，见 [LICENSE](LICENSE)。基于 NodeSeek++ 等开源组件，第三方许可证声明保留在脚本头部。
