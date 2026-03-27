# 思卡 (SiKa)

记录你在接触音乐、书籍、电影时产生的想法。

> 本项目由 [Claude Brain](https://github.com/linvie/Claude-Brain) 自动调度开发。

## 核心概念

- **卡片**：最小记录单位，包含一段用户文字，可关联到一个作品（音乐专辑、书籍、电影）
- **AI 对话**：在卡片内触发，基于卡片内容和关联作品信息与 DeepSeek AI 对话，对话结束后自动生成一句摘要
- **作品**：卡片可关联的对象，音乐和书籍支持从多个外部数据库搜索元数据，电影手动输入

## 功能

- 新建卡片，写下想法并关联作品，支持删除卡片
- 卡片流：按时间倒序浏览所有卡片
- 卡片详情：查看原始文字、AI 摘要、完整对话记录，继续对话
- 作品详情：查看作品信息及其下所有卡片
- 作品搜索：多数据源聚合搜索
  - 音乐：MusicBrainz + iTunes Search API，支持 Cover Art Archive 封面
  - 书籍：Open Library + Google Books API
  - 本地已收藏作品搜索，带「已收藏」标记
- DeepSeek AI 对话
  - 流式输出（Streaming）实时显示回复
  - 对话风格预设（深度分析、轻松闲聊等）与自定义 Prompt
  - AI 回复支持复制和重新生成
  - 自动生成对话摘要

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 19 + Vite + React Router |
| 后端 | Express |
| 数据库 | SQLite (better-sqlite3) |
| AI | DeepSeek API (兼容 OpenAI 接口) |

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器（前后端同时启动）
npm run dev
```

启动后浏览器访问 http://localhost:5173 即可使用。

## 配置 AI

进入设置页面，填写你的 DeepSeek API Key 即可开始 AI 对话。API Key 存储在本地 `server/data/settings.json`，不会上传。

## 项目结构

```
├── client/                # React 前端
│   └── src/
│       ├── pages/         # 页面组件（CardFeed, CardDetail, NewCard, WorkDetail, Settings）
│       ├── components/    # 通用组件（WorkSearch）
│       └── api.js         # API 调用封装
├── server/                # Express 后端
│   └── src/
│       ├── index.js       # 服务入口
│       ├── db.js          # SQLite 数据库初始化
│       └── routes/        # API 路由（cards, works, conversations, settings）
└── package.json           # 根 package.json，一键安装和启动
```

## 数据存储

所有数据存储在本地 SQLite 数据库 `server/data/sika.db`，包含三张表：

- **works**：作品（类型、名称、创作者、年份、封面 URL、外部 ID）
- **cards**：卡片（正文、关联作品、AI 摘要、创建时间）
- **conversations**：对话记录（关联卡片、角色、消息内容、时间戳）
