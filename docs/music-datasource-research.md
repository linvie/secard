# 音乐数据源调研报告

> 调研日期：2026-03-22
> 背景：当前使用 MusicBrainz 搜索音乐，存在两个问题：1）中文音乐覆盖度不足；2）API 不返回封面图片 URL。

## 1. 当前方案：MusicBrainz

**搜索端点：** `https://musicbrainz.org/ws/2/release-group/?query={query}&type=album&fmt=json&limit=10`

现有代码位于 `server/src/routes/works.js`（第 146-163 行），搜索 release-group 并映射为统一格式（title, creator, year, external_id, type），**不返回 cover_url**。

**存在问题：**
- 中文音乐覆盖度差，大量华语专辑缺失或元数据不完整（编辑社区以欧美/日韩为主）
- API 返回结果不包含封面图片 URL，需额外调用 Cover Art Archive
- 搜索中文关键词时匹配不稳定，中文名 vs 拼音可能得到不同结果

**优势：**
- 完全免费，开放数据
- 仅需 User-Agent，无需 API Key
- 数据结构严谨（区分 release-group / release / recording）

## 2. 候选数据源评估

### 2.1 MusicBrainz Cover Art Archive（补充封面）

| 维度 | 评估 |
|------|------|
| 中文音乐覆盖度 | 不适用（与 MusicBrainz 一致，仅解决封面问题） |
| 封面图片支持 | ⭐⭐⭐ 支持 release-group 级别查询，有 250/500/1200px 多尺寸 |
| 免费可用性 | ✅ 完全免费，无需 API Key |
| 集成难度 | 低（一次额外 HTTP 请求） |

**API 端点：**
```
GET https://coverartarchive.org/release-group/{mbid}/front   → 302 重定向到图片
GET https://coverartarchive.org/release-group/{mbid}/front-250  → 250px 缩略图
```

**关键特性：**
- 支持直接用 release-group MBID 查询，与当前搜索结果无缝衔接
- 图片托管在 Internet Archive CDN，访问稳定
- 覆盖率：主流欧美专辑约 70-90%，中文专辑显著更低

**局限：**
- 仅解决封面问题，不解决中文覆盖度问题
- 每个搜索结果需额外请求一次（可并行），增加延迟
- 中文专辑封面缺失率高

### 2.2 iTunes Search API

| 维度 | 评估 |
|------|------|
| 中文音乐覆盖度 | ⭐⭐⭐⭐ Apple Music 在中国大陆可用，华语曲库较全 |
| 封面图片支持 | ⭐⭐⭐⭐⭐ 所有结果都有封面 URL，支持自定义尺寸 |
| 免费可用性 | ✅ 完全免费，无需 API Key，无需注册 |
| 数据时效性 | ⭐⭐⭐⭐ 与 Apple Music/iTunes Store 同步，新专辑上线快 |

**API 端点：**
```
GET https://itunes.apple.com/search?term={query}&media=music&entity=album&limit=10
```

**关键特性：**
- 无需 API Key、无需注册、无需鉴权，直接调用
- 返回结果包含 `artworkUrl100`（100px），可替换 URL 中尺寸参数获取更大图片（如 `300x300`、`600x600`）
- 支持 `country=CN` 参数指定中国区商店，提升中文结果相关性
- 返回丰富元数据：`artistName`、`collectionName`、`releaseDate`、`primaryGenreName`、`trackCount`
- 中文搜索支持好，周杰伦、陈奕迅、五月天等主流华语歌手覆盖完整
- Apple Music 在大陆、港台、日韩均有运营，亚洲音乐覆盖优于 Spotify

**局限：**
- 官方未公布严格的速率限制，但社区经验约 20 次/分钟
- 独立/地下音乐人覆盖不如网易云/QQ音乐
- 部分搜索结果可能是单曲而非专辑（需用 `entity=album` 过滤）
- 搜索算法黑盒，无法精确控制排序

### 2.3 Spotify Web API

| 维度 | 评估 |
|------|------|
| 中文音乐覆盖度 | ⭐⭐ Spotify 未在中国大陆运营，华语曲库有明显缺口 |
| 封面图片支持 | ⭐⭐⭐⭐⭐ 所有专辑有封面，提供 640/300/64px 三种尺寸 |
| 免费可用性 | ✅ 免费，但需注册 Spotify 开发者账号获取 Client ID/Secret |
| 数据时效性 | ⭐⭐⭐⭐ 发行即同步，时效性好（但仅限 Spotify 收录的内容） |

**API 端点：**
```
GET https://api.spotify.com/v1/search?q={query}&type=album&limit=10
Authorization: Bearer {access_token}
```

**关键特性：**
- 图片质量高，每个结果保证有封面
- Client Credentials Flow 集成简单
- API 设计优秀，文档完善
- 速率限制宽松（约 180 次/分钟）

**局限：**
- **中文音乐覆盖是最大短板**：周杰伦大量专辑不在 Spotify（版权归属 QQ 音乐/KKBOX）、大陆独立音乐人覆盖差
- 需要 OAuth 鉴权（Client Credentials Flow），比无鉴权方案复杂
- 需要管理 token 刷新（每小时过期）
- 台湾/香港歌手覆盖优于大陆歌手

### 2.4 Last.fm API

| 维度 | 评估 |
|------|------|
| 中文音乐覆盖度 | ⭐⭐ 用户群以欧美为主，中文音乐数据稀疏 |
| 封面图片支持 | ⭐⭐ 有图片字段但覆盖率低，大量空值或占位图 |
| 免费可用性 | ✅ 免费，需注册获取 API Key |
| 数据时效性 | ⭐⭐ 社区驱动，新专辑收录不及时 |

**API 端点：**
```
GET https://ws.audioscrobbler.com/2.0/?method=album.search&album={query}&api_key={key}&format=json
```

**关键特性：**
- 社区数据量大（数百万专辑）
- 提供 small/medium/large/extralarge 多种图片尺寸

**局限：**
- 封面图片缺失率高，尤其是非欧美音乐
- 中文搜索匹配不稳定
- 元数据质量参差不齐（社区贡献，有重复和拼写错误）
- 发行日期经常缺失
- **相比 iTunes 和 Spotify，在封面和中文覆盖两个核心问题上均无优势**

### 2.5 网易云音乐 / QQ 音乐（非官方 API）

| 维度 | 评估 |
|------|------|
| 中文音乐覆盖度 | ⭐⭐⭐⭐⭐ 华语曲库最全面，无可替代 |
| 封面图片支持 | ⭐⭐⭐⭐⭐ 所有专辑有高质量封面，支持自定义尺寸 |
| 免费可用性 | ❌ 无官方公开 API |
| 数据时效性 | ⭐⭐⭐⭐⭐ 新歌上架即可搜索 |

**现状：**
- 网易云和 QQ 音乐均无官方公开 API
- 社区方案（如 `NeteaseCloudMusicApi`）因法律问题已被迫下架（原仓库 2023 年归档）
- 仍有大量活跃 fork，但使用存在法律和稳定性风险

**风险：**
- 违反平台服务条款，原项目已收到法律函件并下架
- 逆向工程的接口随时可能失效
- IP 封禁和反爬限制
- 图片 CDN 可能有防盗链
- **不建议在正式项目中依赖**

## 3. 综合对比表

| 数据源 | 中文覆盖 | 封面图片 | 免费可用 | 时效性 | 集成难度 | 推荐度 |
|--------|----------|----------|----------|--------|----------|--------|
| **MusicBrainz**（现有） | ⭐⭐ | ❌ 无 | ✅ 免费 | ⭐⭐⭐ | 已集成 | 现有方案 |
| **Cover Art Archive** | — | ⭐⭐⭐ | ✅ 免费 | — | 低 | 补充封面 |
| **iTunes Search** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ✅ 完全免费 | ⭐⭐⭐⭐ | 极低 | ⭐⭐⭐⭐⭐ |
| **Spotify** | ⭐⭐ | ⭐⭐⭐⭐⭐ | ✅ 需注册 | ⭐⭐⭐⭐ | 中（OAuth） | ⭐⭐⭐ |
| **Last.fm** | ⭐⭐ | ⭐⭐ | ✅ 需注册 | ⭐⭐ | 低 | ⭐⭐ |
| **网易云/QQ（非官方）** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ❌ 无合法API | ⭐⭐⭐⭐⭐ | 高（不稳定） | ❌ 不推荐 |

## 4. 推荐方案

### 方案：iTunes Search API 作为补充数据源（MusicBrainz + iTunes 双源搜索）

**核心思路：** 保留 MusicBrainz 作为默认音乐搜索源（元数据结构最规范），新增 iTunes Search API 作为补充，同时为 MusicBrainz 结果补充 Cover Art Archive 封面。

**实施要点：**

1. **双源搜索策略**
   - 用户搜索音乐时，并行查询 MusicBrainz 和 iTunes Search API
   - MusicBrainz 结果通过 Cover Art Archive 补充封面（`/release-group/{mbid}/front-250`）
   - iTunes 结果自带封面，直接使用 `artworkUrl100`（替换为 `300x300` 获取高清）
   - 合并两个源的结果，去重后返回（以作品名+艺术家名去重）
   - iTunes 结果排序靠前（封面覆盖率更高），MusicBrainz 结果作为补充

2. **iTunes Search API 接入**
   - 端点：`GET https://itunes.apple.com/search?term={query}&media=music&entity=album&country=CN&limit=10`
   - **无需 API Key**，无需用户配置任何密钥
   - 使用 `country=CN` 默认搜索中国区，提升中文结果相关性
   - 字段映射：`collectionName` → title, `artistName` → creator, `releaseDate` → year, `artworkUrl100` → cover_url, `collectionId` → external_id

3. **Cover Art Archive 补充**
   - 对 MusicBrainz 搜索结果，用 release-group MBID 查询 CAA
   - 端点：`GET https://coverartarchive.org/release-group/{mbid}/front-250`
   - 返回 302 重定向到图片 URL（可直接作为 cover_url 使用）
   - 请求返回 404 表示无封面，跳过即可
   - 可并行请求所有结果的封面，减少总延迟

4. **为什么选择 iTunes 而非 Spotify**
   - **零配置**：iTunes 无需 API Key、无需注册、无需 OAuth，开箱即用
   - **中文覆盖更好**：Apple Music 在中国大陆运营，华语曲库完整度远超 Spotify
   - **封面覆盖率 100%**：所有 iTunes 上架专辑必有封面
   - **与现有设计理念一致**：MusicBrainz 也是零配置方案，保持一致体验

### 未来可选优化

- **搜索偏好设置**：允许用户选择优先数据源（iTunes 优先 / MusicBrainz 优先）
- **本地缓存**：搜索结果和封面 URL 做 SQLite 缓存，减少重复请求
- **Spotify 作为可选源**：如果用户配置了 Spotify API 凭据，可作为第三数据源
- **封面图片代理/缓存**：将远程封面下载到本地 `server/data/covers/`，避免外部 CDN 依赖
