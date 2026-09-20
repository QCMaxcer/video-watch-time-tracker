# Video Watch Time Tracker

一个 Chrome Manifest V3 扩展，用于统计 Bilibili、YouTube、抖音和快手的
前台视频观看时长，并将每日累计时长同步到 Obsidian Daily Note。

## 功能

- 仅统计视频页面处于前台且包含有效播放中的视频时产生的观看时间
- 分别统计 Bilibili、YouTube、抖音和快手
- 在扩展弹窗中查看当日与历史累计时长
- 按配置周期自动同步到 Obsidian Daily Note
- 使用 File System Access API 获取 Vault 目录访问权限

## 开发

```powershell
npm install
npm test
npm run build
```

构建产物位于 `dist/`。

## 在 Chrome 中加载

1. 打开 `chrome://extensions`。
2. 启用“开发者模式”。
3. 点击“加载已解压的扩展程序”，选择本项目的 `dist/` 目录。
4. 打开扩展设置，配置 Daily Note 文件夹、文件名格式和同步间隔。
5. 选择并授权 Obsidian Vault 根文件夹。

Daily Note 中需要预先包含以下字段：

```text
[PCBilibiliSeconds:: 0]
[PCDouyinSeconds:: 0]
[PCKuaishouSeconds:: 0]
[PCYouTubeSeconds:: 0]
```

扩展只会更新这些已有字段，不会自动创建 Daily Note 或字段。
