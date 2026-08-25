'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

/* ── Markdown Renderer for Executive Reports ──────────────────────── */
function renderMarkdown(text) {
  if (!text) return '';

  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Code blocks
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre><code class="language-${lang}">${code.trim()}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Headers
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Bold & Italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Blockquote
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

  // Tables
  html = html.replace(/^\|(.+)\|$/gm, (match, content) => {
    const cells = content.split('|').map(c => c.trim());
    if (cells.every(c => /^[-:]+$/.test(c))) return '<!--table-sep-->';
    return `<tr>${cells.map(c => `<td>${c}</td>`).join('')}</tr>`;
  });
  html = html.replace(/((<tr>.*<\/tr>\n?)+)/g, (match) => {
    const cleaned = match.replace(/<!--table-sep-->\n?/g, '');
    const rows = cleaned.trim().split('\n');
    if (rows.length > 0) {
      rows[0] = rows[0].replace(/<td>/g, '<th>').replace(/<\/td>/g, '</th>');
    }
    return `<table>${rows.join('\n')}</table>`;
  });
  html = html.replace(/<!--table-sep-->\n?/g, '');

  // Lists
  html = html.replace(/^[-•] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/((<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  // Paragraphs
  html = html.replace(/\n\n/g, '</p><p>');
  html = html.replace(/\n/g, '<br>');

  if (!html.startsWith('<')) {
    html = `<p>${html}</p>`;
  }

  return html;
}

/* ── Interactive 3D Canvas Background Component ─────────────────── */
function Canvas3DBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Mouse coordinates for 3D parallax
    let mouseX = width / 2;
    let mouseY = height / 2;
    const handleMouseMove = (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };
    window.addEventListener('mousemove', handleMouseMove);

    // 3D Particles Array
    const particleCount = 70;
    const particles = [];
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        z: Math.random() * 800 + 100, // Depth
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        radius: Math.random() * 2 + 1,
        color: i % 3 === 0 ? 'rgba(0, 242, 254,' : i % 3 === 1 ? 'rgba(99, 102, 241,' : 'rgba(168, 85, 247,',
      });
    }

    let angle = 0;

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      angle += 0.003;

      const targetParallaxX = (mouseX - width / 2) * 0.05;
      const targetParallaxY = (mouseY - height / 2) * 0.05;

      // Draw 3D Floating Isometric Flight Altitude Grid
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 242, 254, 0.04)';
      ctx.lineWidth = 1;
      const gridSize = 60;
      const gridCols = Math.ceil(width / gridSize) + 4;
      const gridRows = 12;

      for (let r = 0; r < gridRows; r++) {
        ctx.beginPath();
        const yOffset = height * 0.65 + r * 30 + targetParallaxY * 0.2;
        ctx.moveTo(0, yOffset);
        ctx.lineTo(width, yOffset);
        ctx.stroke();
      }

      for (let c = 0; c < gridCols; c++) {
        ctx.beginPath();
        const xOffset = c * gridSize + targetParallaxX * 0.3;
        ctx.moveTo(xOffset, height * 0.65);
        ctx.lineTo(xOffset + (c - gridCols / 2) * 20, height);
        ctx.stroke();
      }
      ctx.restore();

      // Render 3D Connected Particles
      for (let i = 0; i < particleCount; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        // 3D perspective projection
        const k = 400 / p.z;
        const projX = p.x + targetParallaxX * (p.z / 800);
        const projY = p.y + targetParallaxY * (p.z / 800);
        const alpha = Math.min(1, Math.max(0.1, (1000 - p.z) / 900));

        ctx.beginPath();
        ctx.arc(projX, projY, p.radius * k, 0, Math.PI * 2);
        ctx.fillStyle = `${p.color} ${alpha * 0.8})`;
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'rgba(0, 242, 254, 0.5)';
        ctx.fill();

        // Connect nearby nodes
        for (let j = i + 1; j < particleCount; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 110) {
            ctx.beginPath();
            ctx.moveTo(projX, projY);
            ctx.lineTo(p2.x + targetParallaxX * (p2.z / 800), p2.y + targetParallaxY * (p2.z / 800));
            ctx.strokeStyle = `rgba(0, 242, 254, ${((110 - dist) / 110) * 0.15})`;
            ctx.stroke();
          }
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas id="canvas3d" ref={canvasRef} />;
}

/* ── Suggested Dynamic Prompts ──────────────────────────────────── */
const QUICK_PROMPTS = [
  {
    icon: '⚡',
    title: "Energy & Renewables Pipeline",
    desc: "Analyze Q3/Q4 pipeline, win values & work order execution",
    query: "How's our pipeline looking for energy sector this quarter?",
  },
  {
    icon: '📊',
    title: "Leadership Board Brief",
    desc: "Generate full executive summary with pipeline & delivery KPIs",
    query: "Generate a leadership update for our board meeting",
  },
  {
    icon: '💰',
    title: "Revenue & Receivables",
    desc: "Compare billed vs collected value and high-priority accounts",
    query: "What is our revenue and outstanding receivables breakdown?",
  },
  {
    icon: '🏆',
    title: "Top High-Value Deals",
    desc: "Inspect top 10 deals across Mining, Railways and Renewables",
    query: "Show me the top 10 highest-value open deals",
  },
];

const SECTORS_LIST = [
  { name: 'Renewables', icon: '☀️', query: 'Analyze the Renewables sector pipeline and operations' },
  { name: 'Mining', icon: '⛏️', query: 'Show me the Mining sector deal funnel and revenue' },
  { name: 'Railways', icon: '🚆', query: 'What is the status of Railway deals and LiDAR surveys?' },
  { name: 'Powerline', icon: '⚡', query: 'Review Powerline inspection deals and work orders' },
  { name: 'Tender', icon: '📑', query: 'Analyze our Tender pipeline opportunities' },
  { name: 'Construction', icon: '🏗️', query: 'How are Construction monitoring projects performing?' },
];

/* ── Main Component ─────────────────────────────────────────────── */
export default function Home() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('connected');
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'overview'
  const [copiedIndex, setCopiedIndex] = useState(null);

  const chatEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + 'px';
    }
  }, [input]);

  const sendMessage = useCallback(async (customQuery = null) => {
    const query = customQuery || input.trim();
    if (!query || isLoading) return;

    const userMsg = { role: 'user', content: query, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const conversationHistory = messages.map(m => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          conversationHistory,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');

      const assistantMsg = {
        role: 'assistant',
        content: data.response,
        isLeadershipUpdate: data.isLeadershipUpdate,
        metadata: data.metadata,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `⚠️ **Error communicating with BI Agent**: ${err.message}`,
          isError: true,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages]);

  const handleCopy = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleExportBrief = (text) => {
    const blob = new Blob([text], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Skylark_Executive_Brief_${new Date().toISOString().split('T')[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="app-container">
      {/* 3D Background Canvas */}
      <Canvas3DBackground />
      <div className="cyber-grid-overlay" />

      {/* ── Top Command HUD Bar ── */}
      <header className="command-header">
        <div className="brand-section">
          <div className="brand-icon-3d">🛩️</div>
          <div>
            <div className="brand-title">
              Skylark Executive BI
              <span className="brand-badge">PROTOTYPE v2.4</span>
            </div>
            <div className="brand-sub">Monday.com Multi-Board Intelligence Hub</div>
          </div>
        </div>

        {/* Live Metrics Ticker */}
        <div className="hud-metrics-ticker">
          <div className="ticker-item">
            <span className="ticker-label">Open Pipeline</span>
            <span className="ticker-val">₹68.82 Cr</span>
          </div>
          <div className="ticker-divider" />
          <div className="ticker-item">
            <span className="ticker-label">Contract Value</span>
            <span className="ticker-val">₹21.16 Cr</span>
          </div>
          <div className="ticker-divider" />
          <div className="ticker-item">
            <span className="ticker-label">Cash Collected</span>
            <span className="ticker-val" style={{ color: 'var(--emerald-core)' }}>₹9.04 Cr</span>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="header-actions">
          <div className="sync-status-badge">
            <span className="status-radar-dot" />
            <span>Monday.com Live Sync (520 Items)</span>
          </div>

          <div className="view-mode-tabs">
            <button
              className={`view-tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
              onClick={() => setActiveTab('chat')}
            >
              💬 Chat BI
            </button>
            <button
              className={`view-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('overview');
                if (messages.length === 0) {
                  sendMessage('Generate a leadership update');
                }
              }}
            >
              📊 Executive HUD
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Viewport ── */}
      <div className="main-viewport">
        {/* Left Telemetry & Vertical Navigator Sidebar */}
        <aside className="hud-sidebar">
          <div>
            <div className="sidebar-title">
              <span>Holographic Telemetry</span>
              <span style={{ color: 'var(--cyan-core)' }}>3D HUD</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div
                className="hologram-kpi-card"
                onClick={() => sendMessage("What are our highest value open deals in the pipeline?")}
              >
                <div className="kpi-head">
                  <span className="kpi-title">Active Pipeline</span>
                  <span className="kpi-icon">📈</span>
                </div>
                <div className="kpi-value">₹68.82 Cr</div>
                <div className="kpi-sub">
                  <span>↗</span> 49 Active Deals In Play
                </div>
              </div>

              <div
                className="hologram-kpi-card"
                onClick={() => sendMessage("Breakdown of total contract value and work order status")}
              >
                <div className="kpi-head">
                  <span className="kpi-title">Work Order Execution</span>
                  <span className="kpi-icon">⚙️</span>
                </div>
                <div className="kpi-value">₹21.16 Cr</div>
                <div className="kpi-sub" style={{ color: 'var(--cyan-core)' }}>
                  <span>●</span> 117 Completed · 25 Ongoing
                </div>
              </div>

              <div
                className="hologram-kpi-card"
                onClick={() => sendMessage("Show outstanding receivables and priority collections")}
              >
                <div className="kpi-head">
                  <span className="kpi-title">Cash Collected</span>
                  <span className="kpi-icon">💳</span>
                </div>
                <div className="kpi-value">₹9.04 Cr</div>
                <div className="kpi-sub" style={{ color: 'var(--amber-core)' }}>
                  <span>⚠</span> ₹3.63 Cr Pending AR
                </div>
              </div>
            </div>
          </div>

          {/* Sector Quick Navigator */}
          <div>
            <div className="sidebar-title">
              <span>Sector Radar</span>
              <span style={{ color: 'var(--text-muted)' }}>6 Verticals</span>
            </div>
            <div className="sector-list">
              {SECTORS_LIST.map((sec, i) => (
                <button
                  key={i}
                  className="sector-pill-btn"
                  onClick={() => sendMessage(sec.query)}
                >
                  <span>{sec.icon} {sec.name}</span>
                  <span className="sector-pill-badge">Query</span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Center Chat Command Workspace */}
        <main className="chat-workspace">
          <div className="chat-scroll-area">
            <div className="chat-center-content">
              {/* 3D Hero Welcome Panel (Shown on clean state) */}
              {messages.length === 0 && (
                <div className="hero-3d-panel">
                  <div className="drone-holo-sphere">
                    <div className="radar-ring" />
                    <div className="radar-ring" />
                    <div className="drone-icon-float">🚁</div>
                  </div>
                  <h1 className="hero-heading">Welcome to Skylark BI Intelligence</h1>
                  <p className="hero-subtitle">
                    Integrated directly with Monday.com <strong>Deals</strong> & <strong>Work Orders</strong> boards.
                    Ask questions in natural language, request sector drilldowns, or generate boardroom-ready executive briefings.
                  </p>

                  <div className="prompt-chips-grid">
                    {QUICK_PROMPTS.map((p, i) => (
                      <div
                        key={i}
                        className="prompt-card-3d"
                        onClick={() => sendMessage(p.query)}
                      >
                        <div className="prompt-icon">{p.icon}</div>
                        <div>
                          <div className="prompt-text-title">{p.title}</div>
                          <div className="prompt-text-desc">{p.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Message Stream */}
              {messages.map((msg, index) => (
                <div key={index} className={`chat-msg-row ${msg.role}`}>
                  <div className="msg-avatar-holo">
                    {msg.role === 'assistant' ? '🤖' : '👤'}
                  </div>

                  <div className="msg-bubble-3d">
                    {msg.isLeadershipUpdate && (
                      <div className="msg-exec-badge">
                        <span>📊</span> Executive Leadership Briefing
                      </div>
                    )}

                    <div
                      dangerouslySetInnerHTML={{
                        __html: msg.role === 'assistant'
                          ? renderMarkdown(msg.content)
                          : msg.content.replace(/\n/g, '<br>'),
                      }}
                    />

                    {msg.role === 'assistant' && (
                      <div className="msg-actions-bar">
                        <button
                          className="action-chip-btn"
                          onClick={() => handleCopy(msg.content, index)}
                        >
                          {copiedIndex === index ? '✓ Copied' : '📋 Copy Text'}
                        </button>
                        <button
                          className="action-chip-btn"
                          onClick={() => handleExportBrief(msg.content)}
                        >
                          📥 Export Markdown Brief
                        </button>
                        <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--text-muted)' }}>
                          {msg.timestamp}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Loading Indicator */}
              {isLoading && (
                <div className="loading-holo-row">
                  <div className="msg-avatar-holo" style={{ background: 'var(--gradient-neon)' }}>
                    🤖
                  </div>
                  <div className="loading-holo-box">
                    <div className="sonar-loader" />
                    <span className="loading-text">
                      Synthesizing Monday.com board telemetry & data matrices...
                    </span>
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>
          </div>

          {/* Command Input Area */}
          <div className="input-command-bar">
            <div className="input-hud-box">
              <textarea
                ref={textareaRef}
                className="chat-textarea"
                placeholder="Ask about pipeline value, energy vertical, receivables, or request a leadership update..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                disabled={isLoading}
              />
              <button
                className="send-hud-btn"
                onClick={() => sendMessage()}
                disabled={!input.trim() || isLoading}
                title="Send Command"
              >
                ➤
              </button>
            </div>

            <div className="input-hud-footer">
              <div className="mode-pills-row">
                <button
                  className="mode-pill-toggle"
                  onClick={() => sendMessage('Generate a leadership update')}
                >
                  📑 Executive Brief Mode
                </button>
                <button
                  className="mode-pill-toggle"
                  onClick={() => sendMessage("How's our pipeline looking for energy sector this quarter?")}
                >
                  ⚡ Energy Sector Fast-Query
                </button>
              </div>

              <span>Press <strong>Enter</strong> to transmit · <strong>Shift+Enter</strong> for newline</span>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
