import { useState, useRef, useEffect } from 'react';
import { searchWorks } from '../api';
import './WorkSearch.css';

const TYPES = [
  { value: 'music', label: '音乐', icon: '🎵' },
  { value: 'book', label: '书籍', icon: '📖' },
  { value: 'movie', label: '电影', icon: '🎬' },
];

export default function WorkSearch({ onSelect, onClose }) {
  const [type, setType] = useState('music');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [movieTitle, setMovieTitle] = useState('');
  const [movieCreator, setMovieCreator] = useState('');
  const [movieYear, setMovieYear] = useState('');
  const inputRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [type]);

  useEffect(() => {
    if (type === 'movie') return;
    if (!query.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }

    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await searchWorks({ type, q: query.trim() });
        setResults(data);
        setSearched(true);
      } catch {
        setResults([]);
        setSearched(true);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => clearTimeout(timerRef.current);
  }, [query, type]);

  const handleSelectResult = (item) => {
    onSelect({
      ...(item.is_local && item.id ? { id: item.id } : {}),
      type: item.type,
      title: item.title,
      creator: item.creator,
      year: item.year,
      cover_url: item.cover_url || null,
      external_id: item.external_id || null,
      external_source: item.external_source || null,
    });
  };

  const handleMovieSubmit = () => {
    if (!movieTitle.trim()) return;
    onSelect({
      type: 'movie',
      title: movieTitle.trim(),
      creator: movieCreator.trim() || null,
      year: movieYear ? parseInt(movieYear, 10) : null,
    });
  };

  return (
    <div className="work-search-overlay" onClick={onClose}>
      <div className="work-search-panel" onClick={(e) => e.stopPropagation()}>
        <div className="search-header">
          <h2>搜索作品</h2>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        <div className="type-tabs">
          {TYPES.map((t) => (
            <button
              key={t.value}
              className={`type-tab ${type === t.value ? 'active' : ''}`}
              onClick={() => {
                setType(t.value);
                setQuery('');
                setResults([]);
                setSearched(false);
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {type !== 'movie' ? (
          <>
            <input
              ref={inputRef}
              className="search-input"
              type="text"
              placeholder={type === 'music' ? '搜索专辑或艺术家…' : '搜索书名或作者…'}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />

            {loading && <p className="search-status">搜索中…</p>}

            {!loading && searched && results.length === 0 && (
              <p className="search-status">未找到结果</p>
            )}

            <div className="search-results">
              {results.map((item, idx) => (
                <button
                  key={item.id || item.external_id || idx}
                  className={`result-item${item.is_local ? ' result-local' : ''}`}
                  onClick={() => handleSelectResult(item)}
                >
                  {item.cover_url && (
                    <img className="result-cover" src={item.cover_url} alt="" />
                  )}
                  <div className="result-info">
                    <span className="result-title">
                      {item.title}
                      {item.saved && <span className="badge-saved">已收藏</span>}
                    </span>
                    <span className="result-detail">
                      {[item.creator, item.year].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="movie-form">
            <input
              ref={inputRef}
              className="search-input"
              type="text"
              placeholder="电影名称"
              value={movieTitle}
              onChange={(e) => setMovieTitle(e.target.value)}
            />
            <input
              className="search-input"
              type="text"
              placeholder="导演（可选）"
              value={movieCreator}
              onChange={(e) => setMovieCreator(e.target.value)}
            />
            <input
              className="search-input"
              type="text"
              placeholder="年份（可选）"
              value={movieYear}
              onChange={(e) => setMovieYear(e.target.value)}
            />
            <button
              className="btn-add-movie"
              onClick={handleMovieSubmit}
              disabled={!movieTitle.trim()}
            >
              添加电影
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
