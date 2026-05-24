import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, AlertTriangle, RefreshCw, Flame, MapPin, HeartHandshake, Loader2 } from 'lucide-react';

interface Message {
  id: number;
  role: 'ai' | 'user';
  text: string;
  loading?: boolean;
}

const QUICK_PROMPTS = [
  { label: 'Evacuation plan',  text: 'What should I do right now to prepare to evacuate?',  Icon: MapPin },
  { label: 'Fire is near',     text: 'A bushfire is nearby. What are the immediate steps?',  Icon: Flame },
  { label: 'My family',        text: 'How do I keep my family safe during a bushfire?',      Icon: HeartHandshake },
  { label: 'After the fire',   text: 'The fire has passed. How do I start recovering?',      Icon: RefreshCw },
];

const WELCOME: Message = {
  id: 0,
  role: 'ai',
  text: "Hi, I'm the Haven AI. I can guide you through emergency preparedness, evacuation steps, and recovery resources.\n\nPlease remember: in a life-threatening situation, always call **000** immediately. My guidance is based on verified emergency protocols but is not a substitute for official emergency services.",
};

const SYSTEM_PROMPT =
  `You are Haven AI, an emergency guidance assistant for Australian bushfire preparedness, evacuation, and disaster recovery. ` +
  `Your advice is grounded in verified protocols from NSW RFS, CFA, AFAC, and Services Australia. ` +
  `Always recommend calling 000 for life-threatening emergencies. ` +
  `Keep responses practical, concise, and actionable — users may be under active stress. ` +
  `Never speculate about specific fire locations or behaviour beyond what the user tells you. ` +
  `For recovery resources, refer only to verified Australian government programs.`;

/** Stable per-browser session key — enables Hermes persistent memory across visits. */
function getSessionKey(): string {
  const STORAGE_KEY = 'haven-ai-session';
  let key = localStorage.getItem(STORAGE_KEY);
  if (!key) {
    key = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, key);
  }
  return key;
}

async function getAIResponseHermes(userMessage: string): Promise<string> {
  const res = await fetch('/assistant/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Hermes-Session-Key': getSessionKey(),
    },
    body: JSON.stringify({
      model: 'hermes-agent',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: userMessage },
      ],
      max_tokens: 512,
    }),
  });

  if (!res.ok) throw new Error(`Hermes responded with ${res.status}`);

  const data = await res.json() as { choices: Array<{ message: { content: string } }> };
  return data.choices?.[0]?.message?.content ?? 'Sorry, no response received.';
}

/** Local keyword fallback — used when Hermes is unavailable. */
function getAIResponseLocal(userMessage: string): string {
  const msg = userMessage.toLowerCase();

  if (msg.includes('evacuate') || msg.includes('evacuation') || msg.includes('leave')) {
    return "**Evacuation steps:**\n1. Leave as early as possible — don't wait until fire is visible.\n2. Take your emergency kit: ID, medications, water, phone charger, cash.\n3. Follow your local bushfire survival plan and official evacuation routes.\n4. Text family your destination & ETA.\n5. Close all doors and windows before leaving.\n\nTap 'Evacuate' in Haven to find the nearest open evacuation centre.";
  }
  if (msg.includes('fire') || msg.includes('bushfire') || msg.includes('nearby')) {
    return "**Immediate bushfire actions:**\n1. **Stay informed** — check the Haven alerts and your state's RFS/CFA app.\n2. **If ordered to evacuate, go NOW.** Do not delay.\n3. If sheltering: close all vents, seal gaps under doors, fill sinks/baths with water.\n4. Wear natural-fibre clothing that covers your skin — no synthetic fabrics.\n5. Move to a room on the opposite side of the fire.\n\n⚠️ If trapped, call **000** immediately.";
  }
  if (msg.includes('family') || msg.includes('children') || msg.includes('kids')) {
    return "**Keeping your family safe:**\n- Agree on a meeting point and out-of-area contact person.\n- Teach children to call 000 and your mobile number.\n- Keep children's IDs and medications in your emergency kit.\n- Assign each family member a role in your evacuation plan.\n- Practice your evacuation route so it feels automatic under stress.";
  }
  if (msg.includes('recover') || msg.includes('after') || msg.includes('rebuild')) {
    return "**Post-fire recovery:**\n1. Don't return home until authorities declare it safe.\n2. Document all damage with photos before cleaning up — you'll need this for insurance.\n3. Contact your insurer within 24 hours.\n4. Register with your state's disaster recovery program for grants and support.\n5. Check Haven's Recovery section for verified financial assistance programs.\n\nMental health support: **Beyond Blue 1300 22 4636**, **Lifeline 13 11 14**.";
  }
  if (msg.includes('kit') || msg.includes('pack') || msg.includes('bag')) {
    return "**Emergency kit essentials:**\n- Water (3L per person per day, 72-hour minimum)\n- Non-perishable food + can opener\n- Prescription medications (2 weeks' supply)\n- First aid kit\n- Copies of ID, insurance documents, bank cards\n- Phone charger + portable battery\n- Cash (small notes)\n- Spare clothes and sturdy shoes\n- Battery/hand-crank radio\n- Torch and spare batteries";
  }
  return "I can help with evacuation planning, what to do during a bushfire, family safety, emergency kits, and recovery resources.\n\nFor any life-threatening emergency, call **000**.\n\nWhat specific situation are you preparing for?";
}

async function getAIResponse(userMessage: string): Promise<string> {
  try {
    return await getAIResponseHermes(userMessage);
  } catch {
    return getAIResponseLocal(userMessage);
  }
}

export default function AIAssistant() {
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput]       = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const bottomRef               = useRef<HTMLDivElement>(null);
  const textareaRef             = useRef<HTMLTextAreaElement>(null);
  let nextId                    = useRef(1);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send(text: string) {
    if (!text.trim() || isThinking) return;
    const userMsg: Message = { id: nextId.current++, role: 'user', text: text.trim() };
    const loadingMsg: Message = { id: nextId.current++, role: 'ai', text: '', loading: true };
    setMessages(prev => [...prev, userMsg, loadingMsg]);
    setInput('');
    setIsThinking(true);

    try {
      const reply = await getAIResponse(text.trim());
      setMessages(prev => prev.map(m => m.id === loadingMsg.id ? { ...m, text: reply, loading: false } : m));
    } catch {
      setMessages(prev => prev.map(m =>
        m.id === loadingMsg.id
          ? { ...m, text: 'Sorry, I could not generate a response. Please try again.', loading: false }
          : m
      ));
    } finally {
      setIsThinking(false);
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  function renderText(text: string) {
    // Simple markdown: **bold** → <strong>
    return text.split('\n').map((line, i) => {
      const parts = line.split(/\*\*(.*?)\*\*/g);
      return (
        <React.Fragment key={i}>
          {parts.map((p, j) => j % 2 === 1 ? <strong key={j}>{p}</strong> : p)}
          {i < text.split('\n').length - 1 && <br />}
        </React.Fragment>
      );
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: 'var(--sp-4)', borderBottom: '1px solid var(--c-border-2)', display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
        <div style={{ width: 40, height: 40, borderRadius: 'var(--r-full)', background: 'linear-gradient(135deg, var(--c-info-dim), var(--c-surface-3))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Bot size={20} color="var(--c-info)" />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Haven AI</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--c-safe)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--c-safe)', display: 'inline-block' }} />
            Emergency guidance mode
          </div>
        </div>
      </div>

      {/* Safety disclaimer */}
      <div style={{ padding: 'var(--sp-2) var(--sp-4)' }}>
        <div className="chat-disclaimer">
          <AlertTriangle size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
          Life-threatening emergency? Call <strong>000</strong> immediately. AI guidance is advisory only.
        </div>
      </div>

      {/* Quick prompts (only show at start) */}
      {messages.length <= 1 && (
        <div style={{ padding: 'var(--sp-3) var(--sp-4)', display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
          {QUICK_PROMPTS.map(({ label, text, Icon }) => (
            <button
              key={label}
              className="btn btn-ghost btn-sm"
              onClick={() => send(text)}
              style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-1)' }}
            >
              <Icon size={12} />{label}
            </button>
          ))}
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
        {messages.map((m) => (
          <div
            key={m.id}
            style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}
          >
            {m.role === 'ai' && (
              <div style={{ width: 28, height: 28, borderRadius: 'var(--r-full)', background: 'var(--c-surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginRight: 'var(--sp-2)', alignSelf: 'flex-end' }}>
                <Bot size={14} color="var(--c-info)" />
              </div>
            )}
            <div className={`chat-bubble ${m.role === 'ai' ? 'chat-bubble-ai' : 'chat-bubble-user'}`}>
              {m.loading
                ? <Loader2 size={16} className="spin" color="var(--c-muted)" />
                : renderText(m.text)
              }
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="chat-input-bar">
        <textarea
          ref={textareaRef}
          className=""
          style={{
            flex: 1, background: 'var(--c-surface-2)',
            border: '1px solid var(--c-border-2)',
            borderRadius: 'var(--r-md)', padding: 'var(--sp-2) var(--sp-3)',
            color: 'var(--c-text)', fontFamily: 'inherit', fontSize: '0.9rem',
            resize: 'none', minHeight: 44, maxHeight: 120, lineHeight: 1.5,
          }}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask about evacuation, safety steps, or recovery…"
          rows={1}
          disabled={isThinking}
        />
        <button
          className="btn btn-primary"
          onClick={() => send(input)}
          disabled={!input.trim() || isThinking}
          aria-label="Send message"
          style={{ alignSelf: 'flex-end', minHeight: 44 }}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
