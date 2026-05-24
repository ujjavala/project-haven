import React, { useEffect, useState } from 'react';
import { fetchFeeds, postFeed } from '../api';
import type { FeedDto } from '../types';
import { BadgeCheck, MapPin, Send, Loader2, MessageCircle } from 'lucide-react';

export default function Feed() {
  const [feeds, setFeeds]     = useState<FeedDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [posting, setPosting] = useState(false);

  const load = () => {
    fetchFeeds().then(setFeeds).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  async function handlePost(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setPosting(true);
    try {
      await postFeed(content.trim());
      setContent('');
      load();
    } catch {
      alert('Could not post — are you logged in?');
    } finally {
      setPosting(false);
    }
  }

  return (
    <div>
      <h1 className="page-heading">Community Feed</h1>

      {/* Compose */}
      <div className="card" style={{ marginBottom: 'var(--sp-4)' }}>
        <form onSubmit={handlePost}>
          <textarea
            className="input"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Share a status update, road condition, or resource tip with your community…"
            maxLength={2000}
            rows={3}
            style={{ marginBottom: 'var(--sp-3)', resize: 'vertical' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" disabled={posting || !content.trim()} className="btn btn-primary">
              {posting
                ? <><Loader2 size={15} className="spin" /> Posting…</>
                : <><Send size={14} /> Post update</>
              }
            </button>
          </div>
        </form>
      </div>

      {loading && <div className="spinner" role="status" aria-label="Loading" />}

      {!loading && feeds.length === 0 && (
        <div className="empty-state">
          <MessageCircle size={40} />
          <strong>No posts yet.</strong>
          <span style={{ fontSize: '0.85rem' }}>Be the first to share a community update.</span>
        </div>
      )}

      <div className="card">
        {feeds.map((f) => (
          <article key={f.id} className="feed-item">
            <p style={{ marginBottom: 'var(--sp-2)', lineHeight: 1.55, fontSize: '0.92rem' }}>{f.content}</p>
            <p className="card-meta" style={{ gap: 'var(--sp-3)' }}>
              {f.verified && (
                <span className="badge badge-safe"><BadgeCheck size={10} /> Verified</span>
              )}
              <span>{new Date(f.createdAt).toLocaleString()}</span>
              {f.latitude != null && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <MapPin size={10} />{f.latitude.toFixed(3)}, {f.longitude?.toFixed(3)}
                </span>
              )}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
