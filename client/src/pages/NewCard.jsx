import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { createCard, searchWorks, createWork } from '../api';
import WorkSearch from '../components/WorkSearch';
import './NewCard.css';

export default function NewCard() {
  const navigate = useNavigate();
  const [content, setContent] = useState('');
  const [selectedWork, setSelectedWork] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = useCallback(async () => {
    if (!content.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      let workId = null;
      if (selectedWork) {
        if (selectedWork.id) {
          workId = selectedWork.id;
        } else {
          const created = await createWork({
            type: selectedWork.type,
            title: selectedWork.title,
            creator: selectedWork.creator || null,
            year: selectedWork.year || null,
            cover_url: selectedWork.cover_url || null,
            external_id: selectedWork.external_id || null,
          });
          workId = created.id;
        }
      }
      await createCard({ content: content.trim(), work_id: workId });
      navigate('/');
    } catch (err) {
      setError(err.message || '创建失败，请重试');
      setSubmitting(false);
    }
  }, [content, selectedWork, submitting, navigate]);

  return (
    <div className="new-card">
      <header className="new-card-header">
        <button className="btn-back" onClick={() => navigate('/')}>← 返回</button>
        <h1>新建卡片</h1>
      </header>

      <div className="new-card-form">
        <textarea
          className="card-input"
          placeholder="写下你的想法…"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          autoFocus
          rows={5}
        />

        <div className="work-section">
          {selectedWork ? (
            <div className="selected-work">
              <span className="work-type-icon">
                {selectedWork.type === 'music' ? '🎵' : selectedWork.type === 'book' ? '📖' : '🎬'}
              </span>
              <div className="work-info">
                <span className="work-title">{selectedWork.title}</span>
                {selectedWork.creator && <span className="work-creator">{selectedWork.creator}</span>}
              </div>
              <button className="btn-remove" onClick={() => setSelectedWork(null)}>✕</button>
            </div>
          ) : (
            <button className="btn-link-work" onClick={() => setShowSearch(true)}>
              + 关联作品
            </button>
          )}
        </div>

        {error && <p className="new-card-error">{error}</p>}

        <button
          className="btn-submit"
          onClick={handleSubmit}
          disabled={!content.trim() || submitting}
        >
          {submitting ? '创建中…' : '创建卡片'}
        </button>
      </div>

      {showSearch && (
        <WorkSearch
          onSelect={(work) => {
            setSelectedWork(work);
            setShowSearch(false);
          }}
          onClose={() => setShowSearch(false)}
        />
      )}
    </div>
  );
}
