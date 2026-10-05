# NodeSeek Max

NodeSeek / DeepFlood 用户脚本，当前版本 **1.7.3**。使用 [SB Theme UI](https://sb.sb/) 的配色、系统字体、布局和短时过渡，保留论坛原生编辑与提交。

## 安装

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 或 Violentmonkey。
2. [安装最新版脚本](https://raw.githubusercontent.com/Ethan2258/Nodeseek-max/main/nodeseek-max.user.js)。
3. 停用其他 NodeSeek 增强脚本，避免重复注入。

[版本与安装文件](https://github.com/Ethan2258/Nodeseek-max/releases) · [独立 Stylus 样式](https://raw.githubusercontent.com/Ethan2258/Nodeseek-max/main/theme/nodeseek-max.user.css)

## 当前功能

- 全站 SB 样式，统一浅色、深色、字体、按钮、输入框、图标和弹窗。
- 首先呈现当前页主题、过滤和编辑器，再启动热榜与其他增强；输入时不重复扫描整页。
- 桌面个人卡、八个快捷入口、今日热门日榜和列表控制区 NQ 入口。
- 帖子列表不自动翻页；评论默认按需追加，更新底部页码，当前页明确引用整理为楼中楼。
- 回复保留 Markdown、附件、表情、预览与快捷粘贴图片，提交仍由原站处理。
- 追加评论优先复用兼容的原生互动组件；不兼容时，互动入口打开该评论原页。
- 通知与私信使用统一消息中心，列表先加载一页，通知正文按点击加载。
- 保留外链直达、关键词过滤、黑名单通知过滤与代码复制。顶栏支持关键词及深浅色切换。
- 脚本面板只保留“关于”和“检查更新”，按需创建。

移除信用分、信任分、注册天数、阅读历史、帖子监控、回帖足迹、重复资料卡及旧工具条；不提供配置导入导出。默认使用本机系统字体，不下载网页字体。

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

测试需要 Chromium；可通过 `NSMAX_CHROMIUM` 指向已有 Chrome。套件快照在 `theme/sb-suite.css`，适配在 `theme/sb-adapter.css`，回复与分页桥接在 `theme/ui-runtime.js`，消息与关于弹窗样式在 `theme/messages.css`、`theme/settings.css`。

浏览器回归使用真实结构的本地模拟页面；耗时数据不能代表论坛服务器或用户网络速度。原生接口、验证码和权限由站点处理。

## 许可证

GPL-3.0-only，见 [LICENSE](LICENSE)。基于 NodeSeek++ 等开源组件，第三方许可证声明保留在脚本头部。
