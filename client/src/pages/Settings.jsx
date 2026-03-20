import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchSettings, updateSettings } from '../api';
import './Settings.css';

export default function Settings() {
  const [apiKey, setApiKey] = useState('');
  const [currentKey, setCurrentKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    fetchSettings()
      .then((data) => setCurrentKey(data.deepseek_api_key || ''))
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
    </div>
  );
}
