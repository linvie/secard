import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchCards, deleteCard } from '../api';
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

  const handleDelete = async (e, cardId) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm('确定要删除这张卡片吗？删除后无法恢复。')) return;
    try {
      await deleteCard(cardId);
      setCards((prev) => prev.filter((c) => c.id !== cardId));
    } catch {
      alert('删除失败，请重试');
    }
  };

  return (
    <div className="card-feed">
      <header className="feed-header">
        <h1>思卡</h1>
        <div className="feed-actions">
          <Link to="/settings" className="btn-settings" title="设置">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
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
          <div key={card.id} className="card-item-wrapper">
            <Link to={`/cards/${card.id}`} className="card-item">
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
            <button
              className="btn-delete-card"
              title="删除卡片"
              onClick={(e) => handleDelete(e, card.id)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
