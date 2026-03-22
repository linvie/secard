# 搜索相关性优化方案

> 调研日期：2026-03-22
> 背景：当前搜索直接透传外部 API 的搜索结果，相关性取决于外部 API 的排序逻辑，用户反馈相关性一般。

## 1. 问题分析

### 1.1 现状

当前搜索实现位于 `server/src/routes/works.js`，逻辑如下：
- 音乐：调用 MusicBrainz release-group 搜索 API，参数仅 `query={用户输入}&type=album&fmt=json&limit=10`
- 书籍：调用 Open Library 搜索 API，参数仅 `q={用户输入}&limit=10`
- 电影：不支持外部搜索，手动输入

### 1.2 存在的问题

| 问题 | 详情 |
|------|------|
| 参数未优化 | MusicBrainz 的 `type=album` 是 URL 参数而非 Lucene 查询字段，**不起过滤作用**；Open Library 使用全文搜索 `q` 而非字段搜索 |
| 无语言偏好 | 搜索中文关键词时，返回大量无关的英文/日文结果 |
| 单数据源 | 每种类型只有一个数据源，无法交叉验证或补充 |
| 无本地排序 | 直接透传 API 返回顺序，未根据用户场景做二次排序 |
| 无封面图片（音乐） | MusicBrainz 搜索结果不含封面，Cover Art Archive 未接入 |
| 无本地缓存搜索 | 用户之前关联过的作品无法优先匹配 |

## 2. 优化方案

### 2.1 外部 API 搜索参数优化（P0，低成本高收益）

#### MusicBrainz

**当前调用：**
```
/ws/2/release-group/?query={query}&type=album&fmt=json&limit=10
```

**优化方案：**

1. **使用 Lucene 查询语法替代裸查询**
   - 当前 `type=album` 作为 URL 参数无实际过滤效果
   - 改为在 query 中使用 `primarytype:album`：
     ```
     query=releasegroup:{用户输入} AND primarytype:album
     ```

2. **启用 dismax 模式处理用户输入**
   - 添加 `dismax=true` 参数，自动转义用户输入中的 Lucene 特殊字符（如引号、括号）
   - 适合直接转发用户输入的场景

3. **考虑切换到 release 端点以支持语言过滤**
   - release-group 端点**不支持** `lang` 和 `script` 字段
   - release 端点支持：`lang:zho`（中文）、`script:Hani`（汉字）、`country:CN/TW/HK`
   - 方案：搜索 release 端点 → 按 `rgid` 去重得到 release-group 级别结果
   - 示例：
     ```
     /ws/2/release/?query=release:{用户输入} AND primarytype:album&fmt=json&limit=20
     ```
   - 检测到中文输入时，额外发一次带 `lang:zho` 的查询，合并结果

4. **接入 Cover Art Archive 获取封面**
   - URL 模式：`https://coverartarchive.org/release-group/{rgid}/front-500`
   - 无需额外 API 调用，直接拼接 URL 作为 `cover_url`
   - 注意：不是所有专辑都有封面（404），前端需处理加载失败

5. **注意速率限制**
   - MusicBrainz 限制：平均 1 请求/秒
   - 当前 400ms 前端防抖 + 无后端限流 → 可能触发 503
   - 建议：后端添加请求队列或最小间隔控制（1 秒）

#### Open Library

**当前调用：**
```
/search.json?q={query}&limit=10
```

**优化方案：**

1. **使用字段搜索替代全文搜索**
   - `q={query}` 搜索所有字段，噪声大
   - 改为 `title={query}` 按书名搜索，精确度显著提升
   - 如果用户输入含空格且看起来像 "作者 书名"，可拆分为 `title=X&author=Y`

2. **检测中文输入时添加语言过滤**
   - 添加 `language=chi` 参数（ISO 639-2/B 中文代码）
   - 注意：很多中文书未设置 language 字段，纯过滤会丢结果
   - 策略：并行发两个请求（带/不带 language 过滤），合并去重

3. **使用 `fields` 参数减少响应体积**
   - 添加 `fields=key,title,author_name,cover_i,first_publish_year,isbn,language,edition_count`
   - 减少传输量，加快响应速度

4. **按 edition_count 辅助排序**
   - 版本数多的书通常更知名，作为排序因子之一

### 2.2 多数据源聚合搜索与结果合并去重（P1，中等成本）

#### 音乐：MusicBrainz + 本地数据库

**策略：**
1. 并行查询 MusicBrainz API 和本地 works 表
2. 本地结果（用户之前关联过的作品）优先展示
3. 外部结果按以下规则去重：
   - 按 `external_id`（MBID）与本地 works 表匹配
   - 匹配到的外部结果标记为"已收藏"而非重复展示

**合并顺序：**
```
[本地精确匹配] → [本地模糊匹配] → [外部 API 结果（去重后）]
```

#### 书籍：Open Library + Google Books（可选）

**策略：**
1. Open Library 作为主源（免费、无需 Key）
2. 检测中文输入时，可考虑添加 Google Books 作为补充源
   - Google Books 中文覆盖度优于 Open Library
   - 需要 API Key，免费额度 1000 次/天
   - 端点：`https://www.googleapis.com/books/v1/volumes?q=intitle:{query}&langRestrict=zh`
3. 去重策略：按 ISBN 去重 > 按标题+作者模糊匹配去重

**是否引入 Google Books 的建议：**
- 如果用户主要搜索中文书籍 → 建议引入，收益明显
- 如果主要搜索英文书籍 → Open Library 已够用，暂不引入
- 折中方案：仅在检测到中文输入 + Open Library 结果少于 3 条时，fallback 到 Google Books

#### 去重算法

```
function dedup(results):
  seen = {}
  for result in results:
    // 1. 精确匹配：external_id 相同
    if result.external_id in seen:
      merge(seen[result.external_id], result)  // 取更完整的元数据
      continue
    // 2. 模糊匹配：标题相似度 > 0.8 且创作者相似度 > 0.7
    for existing in seen.values():
      if similarity(result.title, existing.title) > 0.8
         and similarity(result.creator, existing.creator) > 0.7:
        merge(existing, result)
        break
    else:
      seen[result.key] = result
  return seen.values()
```

### 2.3 本地二次排序（P0，低成本高收益）

外部 API 返回结果后，在本地进行二次排序，提升与用户意图的匹配度。

#### 排序因子

| 因子 | 权重 | 说明 |
|------|------|------|
| 标题精确匹配 | 最高 | 标题与查询完全相同（忽略大小写）→ 置顶 |
| 标题前缀匹配 | 高 | 标题以查询开头 → 高优先级 |
| 中文结果加权 | 中高 | 检测到中文输入时，包含中文字符的结果加分 |
| 创作者匹配 | 中 | 查询词出现在创作者名中 → 加分 |
| 本地已存在 | 中 | 在 works 表中已存在的作品 → 加分（用户可能想再次关联） |
| 元数据完整度 | 低 | 有封面、有年份、有创作者的结果 → 小幅加分 |
| 版本/版次数 | 低 | edition_count 或 releases 数量多 → 小幅加分（书籍） |

#### 中文检测逻辑

```javascript
function containsChinese(text) {
  return /[\u4e00-\u9fff]/.test(text);
}

function isChinese(query) {
  // 查询中包含中文字符即视为中文搜索
  return containsChinese(query);
}
```

#### 评分函数示意

```javascript
function scoreResult(result, query) {
  let score = 0;
  const queryLower = query.toLowerCase();
  const titleLower = (result.title || '').toLowerCase();

  // 标题精确匹配
  if (titleLower === queryLower) score += 100;
  // 标题前缀匹配
  else if (titleLower.startsWith(queryLower)) score += 60;
  // 标题包含查询
  else if (titleLower.includes(queryLower)) score += 30;

  // 中文输入偏好
  if (isChinese(query) && containsChinese(result.title)) score += 40;

  // 创作者匹配
  if (result.creator && result.creator.toLowerCase().includes(queryLower)) score += 20;

  // 元数据完整度
  if (result.cover_url) score += 5;
  if (result.year) score += 3;
  if (result.creator) score += 3;

  return score;
}
```

### 2.4 本地搜索索引评估（P2，高成本，当前不建议）

#### 是否需要？

**结论：当前阶段不需要。**

**理由：**
1. **数据量小**：本地 works 表预计在百到千级别，SQLite 的 LIKE 查询已足够快
2. **搜索场景单一**：用户搜索作品名/创作者名，不需要复杂的全文检索
3. **引入成本高**：需要额外依赖（如 SQLite FTS5 或 MeiliSearch），增加项目复杂度
4. **外部 API 是主要搜索入口**：用户主要通过外部 API 发现新作品，本地搜索只是辅助

#### 未来什么时候需要？

当满足以下条件时可考虑引入：
- 本地 works 表超过 5000 条
- 用户频繁搜索已有作品（而非新作品）
- 需要对卡片内容做全文搜索（而不仅是作品名）

#### 如果需要，推荐方案

**SQLite FTS5**（首选）：
- 零额外依赖，better-sqlite3 原生支持
- 支持中文分词（需配置 tokenizer）
- 适合本项目的轻量级场景
- 示例：
  ```sql
  CREATE VIRTUAL TABLE works_fts USING fts5(title, creator, tokenize='unicode61');
  INSERT INTO works_fts(rowid, title, creator) SELECT id, title, creator FROM works;
  SELECT * FROM works_fts WHERE works_fts MATCH '三体';
  ```

## 3. 实施建议

### 阶段一（P0，建议立即实施）

| 改动 | 预期效果 | 工作量 |
|------|---------|--------|
| MusicBrainz 使用 Lucene 查询语法 + `primarytype:album` | 过滤非专辑结果 | 0.5h |
| MusicBrainz 添加 `dismax=true` | 避免特殊字符导致搜索失败 | 5min |
| Open Library 改用 `title=` 字段搜索 | 减少不相关结果 | 0.5h |
| Open Library 添加 `fields` 参数 | 减少响应体积，加快速度 | 5min |
| 接入 Cover Art Archive | 音乐搜索结果显示封面 | 0.5h |
| 本地二次排序（标题匹配度 + 中文加权） | 最相关结果排在前面 | 1h |
| 后端请求限流（1 请求/秒） | 避免被 MusicBrainz 封禁 | 0.5h |

**预计总工作量：3-4 小时**

### 阶段二（P1，视用户反馈决定）

| 改动 | 预期效果 | 工作量 |
|------|---------|--------|
| 本地 works 表联合搜索 | 已关联过的作品优先展示 | 1h |
| 中文输入检测 + 语言偏好过滤 | 中文搜索返回更多中文结果 | 1h |
| MusicBrainz 切换到 release 端点 + 按 rgid 去重 | 支持语言过滤 | 2h |
| 多源结果去重合并 | 多数据源结果无重复 | 1.5h |

**预计总工作量：5-6 小时**

### 阶段三（P2，长期优化）

| 改动 | 预期效果 | 工作量 |
|------|---------|--------|
| 引入 Google Books 作为书籍补充源 | 改善中文书籍覆盖 | 2h |
| SQLite FTS5 本地全文搜索 | 大数据量下快速搜索 | 3h |
| 搜索结果缓存（内存/SQLite） | 减少重复 API 调用 | 1.5h |

**预计总工作量：6-7 小时**

## 4. 总结

搜索相关性的核心问题是 **参数未优化** 和 **无本地排序**。阶段一的优化成本低、收益高，建议优先实施。多数据源聚合和语言过滤是阶段二的重点，可根据用户反馈决定。本地搜索索引在当前数据量下不需要，留作长期储备。
