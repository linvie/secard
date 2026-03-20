import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchCards } from '../api';
import './CardFeed.css';

export default function CardFeed() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCards()
      .then(setCards)
      .catch(() => setCards([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="card-feed">
      <header className="feed-header">
        <h1>思卡</h1>
        <div className="feed-actions">
          <Link to="/settings" className="btn-settings" title="设置">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="10" cy="10" r="3" />
              <path d="M10 1.5v2M10 16.5v2M1.5 10h2M16.5 10h2M3.4 3.4l1.4 1.4M15.2 15.2l1.4 1.4M3.4 16.6l1.4-1.4M15.2 4.8l1.4-1.4" />
            </svg>
          </Link>
          <Link to="/new" className="btn-new">+ 新建卡片</Link>
        </div>
      </header>

      {loading && <p className="feed-status">加载中…</p>}

      {!loading && cards.length === 0 && (
        <div className="feed-empty">
          <p>还没有卡片</p>
          <p>记录你在接触音乐、书籍、电影时产生的想法吧</p>
          <Link to="/new" className="btn-new">创建第一张卡片</Link>
        </div>
      )}

      <div className="card-list">
        {cards.map((card) => (
          <Link key={card.id} to={`/cards/${card.id}`} className="card-item">
            <p className="card-content">{card.content}</p>
            <div className="card-meta">
              {card.work_title && (
                <span className="card-work">
                  {card.work_type === 'music' ? '🎵' : card.work_type === 'book' ? '📖' : '🎬'}
                  {' '}{card.work_title}
                </span>
              )}
              {card.message_count > 0 && (
                <span className="card-messages">{card.message_count} 条对话</span>
              )}
              {card.ai_summary && (
                <p className="card-summary">{card.ai_summary}</p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
