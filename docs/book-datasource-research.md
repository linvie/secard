# 书籍数据源调研报告

> 调研日期：2026-03-22
> 背景：当前使用 Open Library 搜索书籍，存在中文书籍覆盖度差、新出版书籍未收录的问题。

## 1. 当前方案：Open Library

**搜索端点：** `https://openlibrary.org/search.json?q={query}&limit=10`
**封面端点：** `https://covers.openlibrary.org/b/id/{cover_id}-M.jpg`

现有代码位于 `server/src/routes/works.js`，搜索结果映射为统一格式（title, creator, year, cover_url, external_id, type）。

**存在问题：**
- 中文书籍覆盖度差，大量中文图书缺失或元数据不完整
- 新书收录延迟大（依赖图书馆目录导入和社区贡献，可能数周到数月）
- 封面图片覆盖率一般

**优势：**
- 完全免费，无需 API Key
- 接口简单，无鉴权要求
- 社区驱动，数据开放

## 2. 候选数据源评估

### 2.1 Google Books API

| 维度 | 评估 |
|------|------|
| 中文书籍覆盖度 | ⭐⭐⭐ 中等偏上，主流中文出版物有收录，但大陆小出版社覆盖弱 |
| 新书收录时效 | ⭐⭐⭐ 英文书数周内收录；中文书延迟较大且不稳定 |
| 封面图片质量 | ⭐⭐⭐⭐ 多种尺寸可选（zoom=1~4），缩略图~128px，大图可达~400px |
| 免费可用性 | ⭐⭐⭐ 免费 1,000 次/天，需 Google Cloud API Key |

**API 示例：**
```
GET https://www.googleapis.com/books/v1/volumes?q={query}&langRestrict=zh&key={API_KEY}
```

**关键特性：**
- 支持 `langRestrict=zh` 限定中文结果
- 支持 `intitle:`, `inauthor:`, `isbn:` 等高级搜索
- 返回 `imageLinks.thumbnail` 封面 URL，可通过修改 zoom 参数获取不同尺寸
- 免费额度默认 1,000 次/天，开启 billing 可提升（API 本身不收费）

**局限：**
- 1,000 次/天的免费额度对频繁搜索场景偏低
- 中文书封面缺失率较高
- 部分中文书元数据不完整

### 2.2 豆瓣 API（非官方）

| 维度 | 评估 |
|------|------|
| 中文书籍覆盖度 | ⭐⭐⭐⭐⭐ 中文书籍覆盖最全面，无可替代 |
| 新书收录时效 | ⭐⭐⭐⭐⭐ 新书上市前即有条目，通常出版数天内可搜到 |
| 封面图片质量 | ⭐⭐⭐⭐ 多尺寸（s/m/l），大图约 300-600px，质量良好 |
| 免费可用性 | ⭐ 官方 API 已于 2019 年关闭，无法获取新 API Key |

**现状：**
- 官方 API v2 (`api.douban.com/v2/book/`) 已关闭注册，存量 Key 逐步失效
- 社区存在非官方方案：
  - 爬虫代理（解析 `book.douban.com` HTML）
  - 逆向移动端 API（`frodo.douban.com/api/v2/`，需伪造 User-Agent）
  - ISBN 重定向（`book.douban.com/isbn/<isbn>` → 书籍页面）

**风险：**
- 违反豆瓣服务条款，存在法律风险
- IP 封禁和验证码频繁出现
- 图片有 Referer 防盗链（`img*.doubanio.com`），需代理或缓存
- 页面结构变更会导致爬虫失效，维护成本高
- **不建议在正式项目中依赖**

### 2.3 ISBNdb

| 维度 | 评估 |
|------|------|
| 中文书籍覆盖度 | ⭐⭐ 以英文为主，中文书（978-7-xxx）收录有限 |
| 新书收录时效 | ⭐⭐⭐ 英文新书收录快，中文不可靠 |
| 封面图片质量 | ⭐⭐⭐ 有封面 URL，质量中等，覆盖不全 |
| 免费可用性 | ❌ 纯付费，最低 ~$9.95/月（1,000 次/天） |

**结论：** 付费且中文覆盖差，不适合本项目。

### 2.4 WorldCat（OCLC）

| 维度 | 评估 |
|------|------|
| 中文书籍覆盖度 | ⭐⭐⭐⭐ 聚合全球图书馆目录，中文学术和主流图书覆盖好 |
| 新书收录时效 | ⭐⭐⭐ 取决于成员图书馆编目速度，通常数周 |
| 封面图片质量 | ⭐ 几乎不提供封面图片，以书目元数据为主 |
| 免费可用性 | ❌ Search API v2 需机构会员资格，无个人开发者免费方案 |

**结论：** 中文覆盖虽好，但 API 准入门槛极高（需机构会员），且不提供封面图片，不适合本项目。

## 3. 综合对比表

| 数据源 | 中文覆盖 | 新书时效 | 封面质量 | 免费可用 | 集成难度 | 推荐度 |
|--------|----------|----------|----------|----------|----------|--------|
| **Open Library** | ⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ✅ 完全免费 | 低 | 现有方案 |
| **Google Books** | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ✅ 1K/天免费 | 低 | ⭐⭐⭐⭐ |
| **豆瓣（非官方）** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ❌ 无合法API | 高（不稳定） | ❌ 不推荐 |
| **ISBNdb** | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ❌ 付费 | 低 | ❌ 不推荐 |
| **WorldCat** | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐ | ❌ 需机构会员 | 高 | ❌ 不推荐 |

## 4. 推荐方案

### 方案：Google Books API 作为补充数据源（Open Library + Google Books 双源搜索）

**核心思路：** 保留 Open Library 作为默认书籍搜索源，新增 Google Books API 作为补充，特别是在以下场景自动 fallback：
- 用户搜索中文书名时
- Open Library 返回结果过少或无结果时

**实施要点：**

1. **双源搜索策略**
   - 用户搜索书籍时，优先查询 Open Library（免费无限制）
   - 当 Open Library 结果不足（如 < 3 条）或检测到中文查询时，并行查询 Google Books API
   - 合并去重后返回结果（以 ISBN/external_id 去重）

2. **Google Books API 接入**
   - 端点：`GET https://www.googleapis.com/books/v1/volumes?q={query}&langRestrict=zh`
   - API Key 存储在 `server/data/settings.json`（复用现有设置页面模式）
   - 或作为环境变量 `GOOGLE_BOOKS_API_KEY`

3. **封面图片优化**
   - Google Books 封面通常比 Open Library 质量更高
   - 当两个源都返回封面时，优先使用 Google Books 的封面 URL

4. **注意事项**
   - Google Books 免费额度 1,000 次/天，本地个人使用完全足够
   - 需要用户自行在 Google Cloud Console 创建项目并获取 API Key
   - API Key 可选配置：未配置时仅使用 Open Library，配置后启用双源搜索

### 未来可选优化

- **ISBN 直查增强：** 如果用户输入的是 ISBN，可同时查询 Open Library ISBN 端点（`/isbn/{isbn}.json`）和 Google Books ISBN 搜索（`isbn:{isbn}`），提升精确匹配率
- **本地缓存：** 对搜索结果做本地 SQLite 缓存，减少重复 API 调用
- **中国国家图书馆 OPAC：** 作为长期方案，可考虑接入中国国家图书馆的 Z39.50/SRU 协议获取权威中文书目数据，但集成复杂度较高
