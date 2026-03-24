import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchSettings, updateSettings } from '../api';
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

  useEffect(() => {
    fetchSettings()
      .then((data) => {
        setCurrentKey(data.deepseek_api_key || '');
        setCurrentGbKey(data.google_books_api_key || '');
      })
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

  return (
    <div className="settings-page">
      <Link to="/" className="back-link">← 返回</Link>
      <h1>设置</h1>

      <section className="settings-section">
        <h2>DeepSeek API Key</h2>
        <p className="settings-desc">
          配置 API Key 后即可在卡片详情页与 AI 对话。
          API Key 仅存储在本地，不会上传到任何服务器。
        </p>

        {currentKey && (
          <p className="current-key">当前 Key：<code>{currentKey}</code></p>
        )}

        <form onSubmit={handleSave} className="settings-form">
          <input
            type="password"
            placeholder="输入新的 API Key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <button type="submit" disabled={!apiKey.trim() || saving}>
            {saving ? '保存中…' : '保存'}
          </button>
        </form>

        {message && (
          <p className={`settings-msg settings-msg-${message.type}`}>{message.text}</p>
        )}
      </section>

      <section className="settings-section">
        <h2>Google Books API Key</h2>
        <p className="settings-desc">
          配置后可增强中文书籍搜索结果。未配置时仅使用 Open Library 搜索。
          API Key 仅存储在本地，不会上传到任何服务器。
        </p>

        {currentGbKey && (
          <p className="current-key">当前 Key：<code>{currentGbKey}</code></p>
        )}

        <form onSubmit={handleSaveGb} className="settings-form">
          <input
            type="password"
            placeholder="输入 Google Books API Key"
            value={gbApiKey}
            onChange={(e) => setGbApiKey(e.target.value)}
          />
          <button type="submit" disabled={!gbApiKey.trim() || savingGb}>
            {savingGb ? '保存中…' : '保存'}
          </button>
        </form>

        {gbMessage && (
          <p className={`settings-msg settings-msg-${gbMessage.type}`}>{gbMessage.text}</p>
        )}
      </section>
    </div>
  );
}
