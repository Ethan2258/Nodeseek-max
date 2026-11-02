# 参与开发

先阅读 [开发指南](docs/development.md)，了解源文件、生成文件与测试入口。

## 反馈问题

先查看 [安装与常见问题](docs/installation.md) 和 [使用与设置](docs/usage.md)，再搜索 [已有 issue](https://github.com/Ethan2258/Nodeseek-max/issues)。

- [问题反馈](https://github.com/Ethan2258/Nodeseek-max/issues/new?template=bug_report.yml)：提供版本、环境、页面、复现步骤及预期与实际结果。手机注明横竖屏与触发位置。
- [功能建议](https://github.com/Ethan2258/Nodeseek-max/issues/new?template=feature_request.yml)：描述使用场景、当前不便和期望行为。

截图可帮助定位；提交前请去掉账号令牌、Cookie、私信和其他敏感内容。

## 提交修改

- 围绕一个明确问题修改；保留论坛原生行为与第三方许可证声明。
- UI 修改放在对应 theme 源文件，构建后提交生成结果。
- 依赖修改同时更新 package.json 与 package-lock.json。
- 运行 npm run check，并按修改范围运行专项测试；功能修复应覆盖用户操作和关闭状态。
- 界面变更检查电脑、触屏、深浅色及窄屏；提交说明包含问题、修改后行为与验证结果。
- 改变安装、设置或开发方式时，同步对应文档；用户可见变化记录到更新日志。

仅修改文档或仓库配置无需增加脚本版本；已有版本标签时，Release 会跳过发布。提交 PR 时记录实际验证结果，未执行的检查注明原因。

PR 合并到 main 后，由 CI 和 Release 工作流完成验证与发布；手动发布也要求同一提交的 main CI 成功。[上游合并](upstream/README.md) 使用登记基线，保留本项目自己的适配。
