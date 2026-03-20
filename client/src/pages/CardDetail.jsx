import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchCard, fetchConversations } from '../api';
import './CardDetail.css';

const typeIcon = { music: '🎵', book: '📖', movie: '🎬' };

export default function CardDetail() {
  const { id } = useParams();
  const [card, setCard] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [input, setInput] = useState('');

  useEffect(() => {
    Promise.all([fetchCard(id), fetchConversations(id)])
      .then(([cardData, convData]) => {
        setCard(cardData);
        setMessages(convData);
      })
      .catch(() => setError('无法加载卡片'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="card-detail"><p className="detail-status">加载中…</p></div>;
  if (error || !card) return (
    <div className="card-detail">
      <Link to="/" className="back-link">← 返回</Link>
      <p className="detail-status">{error || '卡片不存在'}</p>
    </div>
  );

  return (
    <div className="card-detail">
      <Link to="/" className="back-link">← 返回</Link>

      <section className="detail-card">
        <p className="detail-content">{card.content}</p>
        <time className="detail-time">{new Date(card.created_at).toLocaleString('zh-CN')}</time>
      </section>

      {card.work_title && (
        <Link to={`/works/${card.work_id}`} className="detail-work">
          <span className="work-icon">{typeIcon[card.work_type] || '📎'}</span>
          <div className="work-info">
            <span className="work-title">{card.work_title}</span>
            {card.work_creator && <span className="work-creator">{card.work_creator}</span>}
          </div>
        </Link>
      )}

      {card.ai_summary && (
        <section className="detail-summary">
          <h2>AI 摘要</h2>
          <p>{card.ai_summary}</p>
        </section>
      )}

      <section className="detail-conversations">
        <h2>对话记录 {messages.length > 0 && <span className="msg-count">{messages.length}</span>}</h2>

        {messages.length === 0 ? (
          <p className="conv-empty">还没有对话，在下方输入开始和 AI 聊聊吧</p>
        ) : (
          <div className="msg-list">
            {messages.map((msg) => (
              <div key={msg.id} className={`msg-item msg-${msg.role}`}>
                <span className="msg-role">{msg.role === 'user' ? '我' : 'AI'}</span>
                <p className="msg-text">{msg.message}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <form className="chat-input" onSubmit={(e) => e.preventDefault()}>
        <input
          type="text"
          placeholder="输入你的想法，和 AI 对话…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button type="submit" disabled={!input.trim()}>发送</button>
      </form>
    </div>
  );
}
