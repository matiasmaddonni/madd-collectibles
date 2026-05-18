/* Header, primary nav, theme toggle, settings dropdown.
   Plain admin chrome — function over form. */

const { useState, useEffect, useRef } = React;

const ShellHeader = ({ active, onNav, theme, onTheme }) => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef(null);
  useEffect(() => {
    if (!settingsOpen) return;
    const close = (e) => { if (settingsRef.current && !settingsRef.current.contains(e.target)) setSettingsOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [settingsOpen]);

  const tabs = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'products',  label: 'Products' },
    { id: 'proposals', label: 'Proposals', badge: window.PROPOSALS.filter(p => p.status === 'new').length },
  ];

  return (
    <header className="ah-header">
      <div className="ah-brand">
        <span className="ah-brand-word">MADD</span>
        <span className="ah-brand-dot">.</span>
        <span className="ah-brand-tag">admin</span>
      </div>

      <nav className="ah-nav">
        {tabs.map(t => (
          <button
            key={t.id}
            className={'ah-nav-item' + (active === t.id ? ' is-active' : '')}
            onClick={() => onNav(t.id)}
          >
            {t.label}
            {t.badge ? <span className="ah-nav-badge">{t.badge}</span> : null}
          </button>
        ))}
        <div className="ah-settings-wrap" ref={settingsRef}>
          <button
            className={'ah-nav-item ah-nav-item--dropdown' + (active === 'settings' ? ' is-active' : '')}
            onClick={() => setSettingsOpen(o => !o)}
            aria-expanded={settingsOpen}
          >
            Settings
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ marginLeft: 4 }}>
              <path d="M2 3.5 5 6.5 8 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          {settingsOpen && (
            <div className="ah-settings-menu" role="menu">
              {[
                { id: 'settings:brands', label: 'Brands', count: window.BRANDS.length },
                { id: 'settings:lines',  label: 'Lines',  count: window.LINES.length },
                { id: 'settings:series', label: 'Series', count: window.SERIES_DATA.length },
              ].map(item => (
                <button
                  key={item.id}
                  className="ah-settings-item"
                  onClick={() => { onNav(item.id); setSettingsOpen(false); }}
                >
                  <span>{item.label}</span>
                  <span className="ah-settings-count">{item.count}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </nav>

      <div className="ah-header-right">
        <button
          className="ah-icon-btn"
          onClick={() => onTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label="Toggle theme"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="3" fill="currentColor"/>
              <g stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                <path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1"/>
              </g>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M13 9.5A5 5 0 0 1 6.5 3a5 5 0 1 0 6.5 6.5Z" fill="currentColor"/>
            </svg>
          )}
        </button>
        <span className="ah-user">matiasmaddonni@gmail.com</span>
        <button className="ah-btn ah-btn--ghost">Sign out</button>
      </div>
    </header>
  );
};

const PageTitle = ({ title, count, right }) => (
  <div className="ah-page-title">
    <h1 className="ah-h1">
      {title}
      {count !== undefined && <span className="ah-h1-count"> ({count})</span>}
    </h1>
    {right}
  </div>
);

const StatusChip = ({ status }) => (
  <span className={`ah-chip ah-chip--${status}`}>{status}</span>
);

const formatRelative = (d) => {
  const now = new Date('2026-05-15T12:00:00');
  const diffMs = now - d;
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  return `${mo}mo ago`;
};

const formatDate = (d) => {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}`;
};

window.ShellHeader = ShellHeader;
window.PageTitle = PageTitle;
window.StatusChip = StatusChip;
window.formatRelative = formatRelative;
window.formatDate = formatDate;
