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
        <Link to="/new" className="btn-new">+ 新建卡片</Link>
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
          <div key={card.id} className="card-item">
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
          </div>
        ))}
      </div>
    </div>
  );
}
