import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchWork, fetchWorkCards } from '../api';
import './WorkDetail.css';

const typeIcon = { music: '🎵', book: '📖', movie: '🎬' };
const typeLabel = { music: '音乐', book: '书籍', movie: '电影' };

export default function WorkDetail() {
  const { id } = useParams();
  const [work, setWork] = useState(null);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([fetchWork(id), fetchWorkCards(id)])
      .then(([workData, cardsData]) => {
        setWork(workData);
        setCards(cardsData);
      })
      .catch(() => setError('无法加载作品'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="work-detail"><p className="work-detail-status">加载中…</p></div>;
  if (error || !work) return (
    <div className="work-detail">
      <Link to="/" className="back-link">← 返回</Link>
      <p className="work-detail-status">{error || '作品不存在'}</p>
    </div>
  );

  return (
    <div className="work-detail">
      <Link to="/" className="back-link">← 返回</Link>

      <section className="work-header">
        {work.cover_url ? (
          <img
            className="work-detail-cover"
            src={work.cover_url}
            alt=""
            onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = ''; }}
          />
        ) : null}
        <span className="work-type-icon" style={work.cover_url ? { display: 'none' } : {}}>
          {typeIcon[work.type] || '📎'}
        </span>
        <div className="work-meta">
          <h1 className="work-detail-title">{work.title}</h1>
          <div className="work-detail-info">
            {work.creator && <span className="work-detail-creator">{work.creator}</span>}
            {work.year && <span className="work-detail-year">{work.year}</span>}
            <span className="work-detail-type">{typeLabel[work.type] || work.type}</span>
          </div>
        </div>
      </section>

      <section className="work-cards-section">
        <h2>关联卡片 {cards.length > 0 && <span className="cards-count">{cards.length}</span>}</h2>

        {cards.length === 0 ? (
          <p className="work-cards-empty">这个作品还没有关联的卡片</p>
        ) : (
          <div className="work-card-list">
            {cards.map((card) => (
              <Link key={card.id} to={`/cards/${card.id}`} className="work-card-item">
                <p className="work-card-content">{card.content}</p>
                <div className="work-card-meta">
                  {card.message_count > 0 && (
                    <span className="work-card-messages">{card.message_count} 条对话</span>
                  )}
                  {card.ai_summary && (
                    <p className="work-card-summary">{card.ai_summary}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
