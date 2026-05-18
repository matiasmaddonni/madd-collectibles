/* Dashboard — at-a-glance view tuned to what the user picked:
   - Counts (Total/Available/Reserved/Sold) + Inventory value tile
   - Sales over time (7/30/90 day toggle)
   - Stock breakdown by line
   - Action items (missing photos/desc/price) — clickable to filter products
   - Recent sold + recent reserved (with age) */

const SparkChart = ({ data, range }) => {
  // simple SVG bar chart, range = number of days
  const slice = data.slice(-range);
  const max = Math.max(2, ...slice.map(d => d.count));
  const total = slice.reduce((a, d) => a + d.count, 0);
  const days = slice.length;
  const w = 720, h = 140, padL = 28, padR = 12, padT = 12, padB = 22;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const bw = innerW / days;
  const ticks = [0, Math.ceil(max / 2), max];
  return (
    <div className="ah-chart-wrap">
      <div className="ah-chart-head">
        <div className="ah-chart-stat">
          <div className="ah-chart-stat-value">{total}</div>
          <div className="ah-chart-stat-label">sold · last {range}d</div>
        </div>
        <div className="ah-chart-stat">
          <div className="ah-chart-stat-value">${slice.reduce((a, d) => a + d.count * 145, 0).toLocaleString()}</div>
          <div className="ah-chart-stat-label">approx revenue (avg $145/item)</div>
        </div>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="ah-chart-svg" aria-label="Sales chart">
        {ticks.map((t, i) => {
          const y = padT + innerH - (t / max) * innerH;
          return (
            <g key={i}>
              <line x1={padL} x2={w - padR} y1={y} y2={y} className="ah-chart-grid" />
              <text x={padL - 6} y={y + 3} textAnchor="end" className="ah-chart-axis">{t}</text>
            </g>
          );
        })}
        {slice.map((d, i) => {
          const x = padL + i * bw + 1;
          const barH = (d.count / max) * innerH;
          const y = padT + innerH - barH;
          return (
            <rect key={i} x={x} y={y} width={Math.max(1, bw - 2)} height={Math.max(0.5, barH)} className="ah-chart-bar" />
          );
        })}
        {/* x-axis labels: 4 evenly spaced */}
        {[0, 0.33, 0.66, 0.99].map((p, i) => {
          const idx = Math.floor(p * (days - 1));
          const x = padL + idx * bw + bw / 2;
          return <text key={i} x={x} y={h - 6} textAnchor="middle" className="ah-chart-axis">{window.formatDate(slice[idx].date)}</text>;
        })}
      </svg>
    </div>
  );
};

const Dashboard = ({ onJumpProducts }) => {
  const [range, setRange] = useState(30);
  const { COUNTERS, INVENTORY_VALUE, SALES_HISTORY, AVG_DAYS_IN_STOCK,
          STOCK_BY_LINE, MISSING, RECENT_SOLD, RECENT_RESERVED } = window;
  const totalLines = STOCK_BY_LINE.reduce((a, l) => a + l.count, 0);

  return (
    <div className="ah-page">
      <window.PageTitle title="Dashboard" right={
        <div className="ah-page-meta">
          <span className="ah-mono ah-dim">Last sync · 2 min ago</span>
        </div>
      } />

      {/* Stat tiles */}
      <div className="ah-tiles">
        <Tile label="Total" value={COUNTERS.total} accent="neutral" />
        <Tile label="Available" value={COUNTERS.available} accent="ok" sub={`${COUNTERS.draft} drafts`} />
        <Tile label="Reserved" value={COUNTERS.reserved} accent="warn" />
        <Tile label="Sold" value={COUNTERS.sold} accent="neutral" />
        <Tile label="Inventory value" value={`$${INVENTORY_VALUE.available.toLocaleString()}`} sub="available only · USD" accent="neutral" wide />
        <Tile label="Avg days in stock" value={AVG_DAYS_IN_STOCK} sub="before sold" accent="neutral" />
      </div>

      {/* Chart */}
      <Card>
        <div className="ah-card-head">
          <div>
            <div className="ah-card-title">Sales over time</div>
            <div className="ah-card-sub">Units sold per day · click a range</div>
          </div>
          <div className="ah-seg">
            {[7, 30, 90].map(r => (
              <button key={r} className={'ah-seg-btn' + (range === r ? ' is-active' : '')} onClick={() => setRange(r)}>{r}d</button>
            ))}
          </div>
        </div>
        <SparkChart data={SALES_HISTORY} range={range} />
      </Card>

      <div className="ah-grid-2">
        {/* Stock by line */}
        <Card>
          <div className="ah-card-head">
            <div>
              <div className="ah-card-title">Stock by line</div>
              <div className="ah-card-sub">Available units only</div>
            </div>
            <div className="ah-mono ah-dim">{totalLines} total</div>
          </div>
          <div className="ah-bars">
            {STOCK_BY_LINE.map(l => {
              const pct = (l.count / STOCK_BY_LINE[0].count) * 100;
              return (
                <button key={l.slug} className="ah-bar-row" onClick={() => onJumpProducts({ line: l.slug })}>
                  <div className="ah-bar-label">{l.name}</div>
                  <div className="ah-bar-track">
                    <div className="ah-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="ah-bar-count ah-mono">{l.count}</div>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Action items */}
        <Card>
          <div className="ah-card-head">
            <div>
              <div className="ah-card-title">Needs attention</div>
              <div className="ah-card-sub">Click to filter products</div>
            </div>
          </div>
          <div className="ah-action-list">
            {[
              { key: 'photos', label: 'Missing photos', count: MISSING.photos.length, severity: 'high' },
              { key: 'price',  label: 'Missing price (drafts)', count: MISSING.price.length, severity: 'high' },
              { key: 'desc',   label: 'Missing description', count: MISSING.desc.length, severity: 'med' },
            ].map(a => (
              <button key={a.key} className="ah-action-row" onClick={() => onJumpProducts({ missing: a.key })}>
                <div className={`ah-action-dot ah-action-dot--${a.severity}`} />
                <div className="ah-action-label">{a.label}</div>
                <div className="ah-action-count ah-mono">{a.count}</div>
                <div className="ah-action-arrow">→</div>
              </button>
            ))}
            <div className="ah-action-sep" />
            <button className="ah-action-row" onClick={() => onJumpProducts({ status: 'reserved' })}>
              <div className="ah-action-dot ah-action-dot--med" />
              <div className="ah-action-label">Reserved &gt; 14 days (chase up)</div>
              <div className="ah-action-count ah-mono">
                {RECENT_RESERVED.filter(p => (new Date('2026-05-15') - p.reservedAt) / 86400000 > 14).length}
              </div>
              <div className="ah-action-arrow">→</div>
            </button>
            <button className="ah-action-row" onClick={() => onJumpProducts({ status: 'draft' })}>
              <div className="ah-action-dot ah-action-dot--low" />
              <div className="ah-action-label">Drafts ready to finish</div>
              <div className="ah-action-count ah-mono">{COUNTERS.draft}</div>
              <div className="ah-action-arrow">→</div>
            </button>
          </div>
        </Card>
      </div>

      <div className="ah-grid-2">
        {/* Recent sold */}
        <Card>
          <div className="ah-card-head">
            <div>
              <div className="ah-card-title">Recently sold</div>
              <div className="ah-card-sub">Last items that flipped to sold</div>
            </div>
          </div>
          <div className="ah-list">
            {RECENT_SOLD.map(p => (
              <div key={p.id} className="ah-list-row">
                <div className="ah-thumb" />
                <div className="ah-list-main">
                  <div className="ah-list-name">{p.name}</div>
                  <div className="ah-list-sub">{window.LINES.find(l => l.slug === p.line)?.name}</div>
                </div>
                <div className="ah-list-meta">
                  <div className="ah-mono">USD {p.price}</div>
                  <div className="ah-dim ah-mono ah-small">{window.formatRelative(p.soldAt)}</div>
                </div>
              </div>
            ))}
            {!RECENT_SOLD.length && <div className="ah-empty">No sales yet.</div>}
          </div>
        </Card>

        {/* Reserved with age */}
        <Card>
          <div className="ah-card-head">
            <div>
              <div className="ah-card-title">Reserved · sorted by age</div>
              <div className="ah-card-sub">Older first — chase the stale ones</div>
            </div>
          </div>
          <div className="ah-list">
            {RECENT_RESERVED.slice().sort((a, b) => a.reservedAt - b.reservedAt).map(p => {
              const days = Math.floor((new Date('2026-05-15') - p.reservedAt) / 86400000);
              const stale = days > 14;
              return (
                <div key={p.id} className="ah-list-row">
                  <div className="ah-thumb" />
                  <div className="ah-list-main">
                    <div className="ah-list-name">{p.name}</div>
                    <div className="ah-list-sub">{window.LINES.find(l => l.slug === p.line)?.name}</div>
                  </div>
                  <div className="ah-list-meta">
                    <div className="ah-mono">USD {p.price}</div>
                    <div className={'ah-mono ah-small ' + (stale ? 'ah-warn' : 'ah-dim')}>
                      {days}d reserved
                    </div>
                  </div>
                </div>
              );
            })}
            {!RECENT_RESERVED.length && <div className="ah-empty">Nothing reserved right now.</div>}
          </div>
        </Card>
      </div>
    </div>
  );
};

const Tile = ({ label, value, sub, accent, wide }) => (
  <div className={`ah-tile ah-tile--${accent || 'neutral'}` + (wide ? ' ah-tile--wide' : '')}>
    <div className="ah-tile-label">{label}</div>
    <div className="ah-tile-value">{value}</div>
    {sub && <div className="ah-tile-sub">{sub}</div>}
  </div>
);

const Card = ({ children }) => <section className="ah-card">{children}</section>;

window.Dashboard = Dashboard;
window.Card = Card;
window.Tile = Tile;
