# 安装与更新

[返回首页](../README.md) · [使用与设置](usage.md)

## 电脑浏览器

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 或 [Violentmonkey](https://violentmonkey.github.io/)。
2. 打开 [安装链接](https://raw.githubusercontent.com/Ethan2258/Nodeseek-max/main/nodeseek-max.user.js)，在管理器中确认安装。
3. 停用功能重复的 NodeSeek++、外链跳转、热榜、黑名单通知脚本，再刷新论坛页面。

Tampermonkey 的早期注入可减少主题切换时的闪烁。管理面板 → 设置 → 配置模式“高级”，查找 Content Script API；支持时可选 UserScripts API Dynamic。设置名称取决于管理器版本，不适用于 Userscripts。脚本“关于”页显示本页的注入时机。

## iPhone Safari + Userscripts

1. 安装并启用 [Userscripts](https://github.com/quoid/userscripts)，按扩展说明设置脚本目录与网站访问权限。
2. 在 **Safari** 打开 [安装链接](https://raw.githubusercontent.com/Ethan2258/Nodeseek-max/main/nodeseek-max.user.js)。
3. 打开 Safari 扩展菜单 → **Userscripts**，确认安装或更新。
4. 返回 NodeSeek / DeepFlood，重新加载页面。

保持默认注入方式即可。Userscripts 通过异步接口保存设置；等待“刷新应用设置”出现后再刷新。读取或保存失败会给出提示，不会用默认值覆盖原来的扩展配置。

手机菜单包括导航、个人入口、热榜和最近浏览；热榜只在 NodeSeek 且相应设置开启时显示。页面禁止编辑器桥接时，脚本保留论坛原生编辑器。

## 更新与版本

- 设置顶部或“关于”页的“检查更新”可检查新版本。
- 也可以重新打开安装链接，确认更新并刷新论坛。
- 当前已发布版本与历史安装文件见 [Releases](https://github.com/Ethan2258/Nodeseek-max/releases)；每个版本的变化见 [更新日志](../CHANGELOG.md)。

## 常见问题

**页面没有变化。** 确认脚本已启用，Safari 扩展有当前网站访问权限，并刷新整个页面。脚本论坛增强部分匹配 www.nodeseek.com / www.deepflood.com；其他匹配站点只执行外链跳转。

**出现重复按钮、主题叠加或重复通知。** 停用功能重叠的论坛增强脚本，再刷新。多个管理器中安装同一脚本也会重复运行。

**选项改了却没有生效。** 先等待保存完成，再点“刷新应用设置”。部分选项只适用于特定页面或设备，例如鼠标悬停与个人主页统计。

**保存失败。** 保留当前页面，恢复扩展权限或稍后重试。不要在未完成保存时刷新。可在状态正常时通过“导出配置”留存自己的设置。

**页面显示验证码、未登录或没有操作权限。** 由论坛处理；先完成站点要求，再重新加载。脚本不会绕过验证码或账号权限。

**仍有问题。** [反馈问题](https://github.com/Ethan2258/Nodeseek-max/issues/new/choose)，提供脚本版本、设备、浏览器、脚本管理器及复现步骤。不要公开 Cookie、令牌、私信或个人配置全文。
