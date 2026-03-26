import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchSettings, updateSettings, fetchAiStyles } from '../api';
import './Settings.css';

export default function Settings() {
  const [apiKey, setApiKey] = useState('');
  const [currentKey, setCurrentKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const [gbApiKey, setGbApiKey] = useState('');
  const [currentGbKey, setCurrentGbKey] = useState('');
  const [savingGb, setSavingGb] = useState(false);
  const [gbMessage, setGbMessage] = useState(null);

  const [styles, setStyles] = useState([]);
  const [selectedStyle, setSelectedStyle] = useState('thoughtful');
  const [customPrompt, setCustomPrompt] = useState('');
  const [savingStyle, setSavingStyle] = useState(false);
  const [styleMessage, setStyleMessage] = useState(null);

  useEffect(() => {
    fetchSettings()
      .then((data) => {
        setCurrentKey(data.deepseek_api_key || '');
        setCurrentGbKey(data.google_books_api_key || '');
        setSelectedStyle(data.ai_style || 'thoughtful');
        setCustomPrompt(data.ai_custom_prompt || '');
      })
      .catch(() => {});
    fetchAiStyles()
      .then((data) => setStyles(data))
      .catch(() => {});
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!apiKey.trim()) return;
    setSaving(true);
    setMessage(null);
    try {
      await updateSettings({ deepseek_api_key: apiKey.trim() });
      setCurrentKey('****' + apiKey.trim().slice(-4));
      setApiKey('');
      setMessage({ type: 'success', text: 'API Key 已保存' });
    } catch {
      setMessage({ type: 'error', text: '保存失败，请重试' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveGb = async (e) => {
    e.preventDefault();
    if (!gbApiKey.trim()) return;
    setSavingGb(true);
    setGbMessage(null);
    try {
      await updateSettings({ google_books_api_key: gbApiKey.trim() });
      setCurrentGbKey('****' + gbApiKey.trim().slice(-4));
      setGbApiKey('');
      setGbMessage({ type: 'success', text: 'API Key 已保存' });
    } catch {
      setGbMessage({ type: 'error', text: '保存失败，请重试' });
    } finally {
      setSavingGb(false);
    }
  };

  const handleSaveStyle = async () => {
    setSavingStyle(true);
    setStyleMessage(null);
    try {
      await updateSettings({ ai_style: selectedStyle, ai_custom_prompt: customPrompt });
      setStyleMessage({ type: 'success', text: 'AI 风格已保存' });
    } catch {
      setStyleMessage({ type: 'error', text: '保存失败，请重试' });
    } finally {
      setSavingStyle(false);
    }
  };

  const currentStyleDesc = styles.find(s => s.key === selectedStyle);

  return (
    <div className="settings-page">
      <Link to="/" className="back-link">← 返回</Link>
      <h1>设置</h1>

      <section className="settings-section">
        <h2>AI 对话风格</h2>
        <p className="settings-desc">
          选择 AI 与你对话时的风格和语气，也可以自定义提示词。
        </p>

        <div className="style-grid">
          {styles.map((style) => (
            <button
              key={style.key}
              className={`style-card${selectedStyle === style.key ? ' style-card-active' : ''}`}
              onClick={() => setSelectedStyle(style.key)}
            >
              <span className="style-card-name">{style.name}</span>
            </button>
          ))}
        </div>

        {currentStyleDesc && selectedStyle !== 'custom' && (
          <p className="style-preview">{currentStyleDesc.description}</p>
        )}

        {selectedStyle === 'custom' && (
          <textarea
            className="custom-prompt-input"
            placeholder="输入自定义的 AI 人设提示词，例如：你是一位诗人，请用诗意的语言回应用户的感想……"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            rows={4}
          />
        )}

        <button
          className="style-save-btn"
          onClick={handleSaveStyle}
          disabled={savingStyle}
        >
          {savingStyle ? '保存中…' : '保存风格'}
        </button>

        {styleMessage && (
          <p className={`settings-msg settings-msg-${styleMessage.type}`}>{styleMessage.text}</p>
        )}
      </section>

      <section className="settings-section">
        <h2>DeepSeek API Key</h2>
        <p className="settings-desc">
          {currentKey
            ? '系统仅保留一个 API Key，修改后将替换现有 Key。'
            : '配置 API Key 后即可在卡片详情页与 AI 对话。'}
          API Key 仅存储在本地，不会上传到任何服务器。
        </p>

        {currentKey && (
          <p className="current-key">当前 Key：<code>{currentKey}</code></p>
        )}

        <form onSubmit={handleSave} className="settings-form">
          <input
            type="password"
            placeholder={currentKey ? '输入新的 Key 以替换现有 Key' : '输入 DeepSeek API Key'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <button type="submit" disabled={!apiKey.trim() || saving}>
            {saving ? '保存中…' : currentKey ? '更新' : '保存'}
          </button>
        </form>

        {message && (
          <p className={`settings-msg settings-msg-${message.type}`}>{message.text}</p>
        )}
      </section>

      <section className="settings-section">
        <h2>Google Books API Key</h2>
        <p className="settings-desc">
          {currentGbKey
            ? '系统仅保留一个 API Key，修改后将替换现有 Key。'
            : '配置后可增强中文书籍搜索结果。未配置时仅使用 Open Library 搜索。'}
          API Key 仅存储在本地，不会上传到任何服务器。
        </p>

        {currentGbKey && (
          <p className="current-key">当前 Key：<code>{currentGbKey}</code></p>
        )}

        <form onSubmit={handleSaveGb} className="settings-form">
          <input
            type="password"
            placeholder={currentGbKey ? '输入新的 Key 以替换现有 Key' : '输入 Google Books API Key'}
            value={gbApiKey}
            onChange={(e) => setGbApiKey(e.target.value)}
          />
          <button type="submit" disabled={!gbApiKey.trim() || savingGb}>
            {savingGb ? '保存中…' : currentGbKey ? '更新' : '保存'}
          </button>
        </form>

        {gbMessage && (
          <p className={`settings-msg settings-msg-${gbMessage.type}`}>{gbMessage.text}</p>
        )}
      </section>
    </div>
  );
}
