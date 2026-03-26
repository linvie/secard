import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchCard, fetchConversations, sendChat, generateSummary, regenerateChat } from '../api';
import './CardDetail.css';

const typeIcon = { music: '🎵', book: '📖', movie: '🎬' };

export default function CardDetail() {
  const { id } = useParams();
  const [card, setCard] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [chatError, setChatError] = useState(null);
  const msgListRef = useRef(null);

  useEffect(() => {
    Promise.all([fetchCard(id), fetchConversations(id)])
      .then(([cardData, convData]) => {
        setCard(cardData);
        setMessages(convData);
      })
      .catch(() => setError('无法加载卡片'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (msgListRef.current) {
      msgListRef.current.scrollTop = msgListRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setInput('');
    setSending(true);
    setChatError(null);

    // Optimistically add user message
    const tempUserMsg = { id: Date.now(), role: 'user', message: text };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const { user_message, assistant_message } = await sendChat(Number(id), text);
      // Replace temp message with real ones
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempUserMsg.id),
        user_message,
        assistant_message,
      ]);
    } catch (err) {
      setChatError(err.message);
      // Remove optimistic message on failure
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
      setInput(text);
    } finally {
      setSending(false);
    }
  };

  const handleGenerateSummary = async () => {
    setChatError(null);
    try {
      const { summary } = await generateSummary(Number(id));
      setCard((prev) => ({ ...prev, ai_summary: summary }));
    } catch (err) {
      setChatError(err.message);
    }
  };

  const handleRegenerate = async () => {
    if (regenerating || sending) return;
    setRegenerating(true);
    setChatError(null);
    try {
      const { assistant_message, deleted_id } = await regenerateChat(Number(id));
      setMessages((prev) => {
        const filtered = deleted_id ? prev.filter((m) => m.id !== deleted_id) : prev;
        return [...filtered, assistant_message];
      });
    } catch (err) {
      setChatError(err.message);
    } finally {
      setRegenerating(false);
    }
  };

  const handleCopy = async (text, msgId) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(msgId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setChatError('复制失败');
    }
  };

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
        <div className="conv-header">
          <h2>对话记录 {messages.length > 0 && <span className="msg-count">{messages.length}</span>}</h2>
          {messages.length > 0 && (
            <button className="btn-summary" onClick={handleGenerateSummary}>
              {card.ai_summary ? '重新生成摘要' : '生成摘要'}
            </button>
          )}
        </div>

        {messages.length === 0 ? (
          <p className="conv-empty">还没有对话，在下方输入开始和 AI 聊聊吧</p>
        ) : (
          <div className="msg-list" ref={msgListRef}>
            {messages.map((msg, idx) => {
              const isAssistant = msg.role === 'assistant';
              const isLastAssistant = isAssistant &&
                messages.slice(idx + 1).every((m) => m.role !== 'assistant');
              return (
                <div key={msg.id} className={`msg-item msg-${msg.role}`}>
                  <span className="msg-role">{msg.role === 'user' ? '我' : 'AI'}</span>
                  <p className="msg-text">{msg.message}</p>
                  {isAssistant && (
                    <div className="msg-actions">
                      <button
                        className="msg-action-btn"
                        title="复制"
                        onClick={() => handleCopy(msg.message, msg.id)}
                      >
                        {copiedId === msg.id ? '已复制' : '复制'}
                      </button>
                      {isLastAssistant && (
                        <button
                          className="msg-action-btn"
                          title="重新生成"
                          onClick={handleRegenerate}
                          disabled={regenerating || sending}
                        >
                          {regenerating ? '生成中…' : '重新生成'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {(sending || regenerating) && (
              <div className="msg-item msg-assistant msg-loading">
                <span className="msg-role">AI</span>
                <p className="msg-text">思考中…</p>
              </div>
            )}
          </div>
        )}
      </section>

      {chatError && <p className="chat-error">{chatError}</p>}

      <form className="chat-input" onSubmit={handleSend}>
        <div className="chat-input-inner">
          <input
            type="text"
            placeholder="输入你的想法，和 AI 对话…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={sending}
          />
          <button type="submit" disabled={!input.trim() || sending}>
            {sending ? '…' : '发送'}
          </button>
        </div>
      </form>
    </div>
  );
}
