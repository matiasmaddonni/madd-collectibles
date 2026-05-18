/* Products — search, filters, compact table with 24px thumbs, inline status menu.
   Default sort: most recently updated. */

const Products = ({ initialFilters }) => {
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState(initialFilters || {});
  const [sort, setSort] = useState({ key: 'updated', dir: 'desc' });
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;

  useEffect(() => { setFilters(initialFilters || {}); setPage(0); }, [initialFilters]);

  const rows = useMemo(() => {
    let r = window.PRODUCTS;
    if (search) {
      const q = search.toLowerCase();
      r = r.filter(p => p.name.toLowerCase().includes(q));
    }
    if (filters.status)  r = r.filter(p => p.status === filters.status);
    if (filters.line)    r = r.filter(p => p.line === filters.line);
    if (filters.brand)   r = r.filter(p => window.LINES.find(l => l.slug === p.line)?.brand === filters.brand);
    if (filters.series)  r = r.filter(p => p.series === filters.series);
    if (filters.missing === 'photos') r = r.filter(p => !p.hasPhoto && p.status !== 'sold');
    if (filters.missing === 'desc')   r = r.filter(p => !p.hasDesc && p.status !== 'sold' && p.status !== 'draft');
    if (filters.missing === 'price')  r = r.filter(p => p.price === 0 && p.status !== 'sold');
    r = [...r].sort((a, b) => {
      const k = sort.key;
      const av = a[k], bv = b[k];
      if (av instanceof Date) return sort.dir === 'desc' ? bv - av : av - bv;
      if (typeof av === 'number') return sort.dir === 'desc' ? bv - av : av - bv;
      return sort.dir === 'desc' ? String(bv).localeCompare(String(av)) : String(av).localeCompare(String(bv));
    });
    return r;
  }, [search, filters, sort]);

  const visible = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));

  const setFilter = (k, v) => setFilters(f => {
    const next = { ...f };
    if (v === null || v === f[k]) delete next[k]; else next[k] = v;
    return next;
  });

  const activeFilterCount = Object.keys(filters).length + (search ? 1 : 0);

  const toggleSort = (key) => setSort(s => s.key === key ? { key, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' });

  return (
    <div className="ah-page">
      <window.PageTitle title="Products" count={window.COUNTERS.total} right={
        <button className="ah-btn ah-btn--primary">+ New Product</button>
      } />

      {/* Toolbar */}
      <div className="ah-toolbar">
        <div className="ah-search">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4"/>
            <path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <input
            type="text"
            placeholder="Search by name…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
          />
          {search && <button className="ah-search-clear" onClick={() => setSearch('')}>×</button>}
        </div>
        <FilterSelect label="Status" value={filters.status} options={[
          { v: 'available', n: 'Available' },
          { v: 'reserved', n: 'Reserved' },
          { v: 'sold', n: 'Sold' },
          { v: 'draft', n: 'Draft' },
        ]} onChange={v => setFilter('status', v)} />
        <FilterSelect label="Line" value={filters.line} options={window.LINES.map(l => ({ v: l.slug, n: l.name }))} onChange={v => setFilter('line', v)} />
        <FilterSelect label="Brand" value={filters.brand} options={[...new Set(window.LINES.map(l => l.brand))].map(b => ({ v: b, n: b }))} onChange={v => setFilter('brand', v)} />
        <FilterSelect label="Series" value={filters.series} options={window.SERIES.map(s => ({ v: s, n: s }))} onChange={v => setFilter('series', v)} />
        {activeFilterCount > 0 && (
          <button className="ah-btn ah-btn--ghost ah-btn--sm" onClick={() => { setFilters({}); setSearch(''); }}>
            Clear ({activeFilterCount})
          </button>
        )}
        <div className="ah-toolbar-spacer" />
        <div className="ah-mono ah-dim ah-small">
          {rows.length} {rows.length === 1 ? 'result' : 'results'}
        </div>
      </div>

      {/* Table */}
      <div className="ah-table-wrap">
        <table className="ah-table">
          <thead>
            <tr>
              <th style={{ width: 36 }}></th>
              <ThCol label="Name" k="name" sort={sort} onSort={toggleSort} />
              <ThCol label="Line" k="line" sort={sort} onSort={toggleSort} />
              <ThCol label="Series" k="series" sort={sort} onSort={toggleSort} />
              <ThCol label="Price" k="price" sort={sort} onSort={toggleSort} align="right" />
              <ThCol label="Status" k="status" sort={sort} onSort={toggleSort} />
              <ThCol label="Cond." k="condition" sort={sort} onSort={toggleSort} />
              <ThCol label="Updated" k="updated" sort={sort} onSort={toggleSort} />
              <th style={{ width: 110, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.map(p => <Row key={p.id} p={p} />)}
            {!visible.length && (
              <tr><td colSpan="9" className="ah-table-empty">
                No products match. <button className="ah-link" onClick={() => { setFilters({}); setSearch(''); }}>Clear filters</button>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="ah-pager">
        <button className="ah-btn ah-btn--ghost ah-btn--sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Prev</button>
        <span className="ah-mono ah-dim ah-small">Page {page + 1} of {totalPages}</span>
        <button className="ah-btn ah-btn--ghost ah-btn--sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next →</button>
      </div>
    </div>
  );
};

const useMemo = React.useMemo;

const ThCol = ({ label, k, sort, onSort, align }) => (
  <th onClick={() => onSort(k)} className="ah-th-sortable" style={{ textAlign: align || 'left' }}>
    <span>{label}</span>
    {sort.key === k && (
      <span className="ah-th-arrow">{sort.dir === 'desc' ? '↓' : '↑'}</span>
    )}
  </th>
);

const FilterSelect = ({ label, value, options, onChange }) => (
  <div className={'ah-filter' + (value ? ' is-active' : '')}>
    <span className="ah-filter-label">{label}</span>
    <select value={value || ''} onChange={e => onChange(e.target.value || null)}>
      <option value="">All</option>
      {options.map(o => <option key={o.v} value={o.v}>{o.n}</option>)}
    </select>
  </div>
);

const Row = ({ p }) => {
  const [status, setStatus] = useState(p.status);
  const [editing, setEditing] = useState(null);
  const [price, setPrice] = useState(p.price);
  const [condition, setCondition] = useState(p.condition);
  const lineName = window.LINES.find(l => l.slug === p.line)?.name || p.line;

  return (
    <tr>
      <td>
        <div className="ah-thumb ah-thumb--xs" title={p.hasPhoto ? 'Has photo' : 'Missing photo'}>
          {!p.hasPhoto && <span className="ah-thumb-warn">!</span>}
        </div>
      </td>
      <td>
        <div className="ah-row-name">
          {p.name}
          {!p.hasDesc && status !== 'draft' && <span className="ah-mini-flag" title="No description">D</span>}
        </div>
      </td>
      <td className="ah-dim">{lineName}</td>
      <td className="ah-dim">{p.series}</td>
      <td style={{ textAlign: 'right' }}>
        {editing === 'price' ? (
          <input
            type="number"
            value={price}
            autoFocus
            className="ah-inline-input"
            onChange={e => setPrice(Number(e.target.value))}
            onBlur={() => setEditing(null)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditing(null); }}
          />
        ) : (
          <span className="ah-mono ah-editable" onClick={() => setEditing('price')}>
            {price === 0 ? <span className="ah-warn">—</span> : `US$ ${price}`}
          </span>
        )}
      </td>
      <td>
        <StatusMenu value={status} onChange={setStatus} />
      </td>
      <td>
        {editing === 'condition' ? (
          <select
            autoFocus
            value={condition}
            className="ah-inline-input"
            onChange={e => { setCondition(e.target.value); setEditing(null); }}
            onBlur={() => setEditing(null)}
          >
            {window.CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        ) : (
          <span className="ah-mono ah-editable ah-small" onClick={() => setEditing('condition')}>{condition}</span>
        )}
      </td>
      <td className="ah-dim ah-mono ah-small">{window.formatRelative(p.updated)}</td>
      <td style={{ textAlign: 'right' }}>
        <div className="ah-row-actions">
          <button className="ah-link" title="Open on storefront">↗</button>
          <button className="ah-link">Edit</button>
        </div>
      </td>
    </tr>
  );
};

const StatusMenu = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  return (
    <span className="ah-status-menu" ref={ref}>
      <button className={`ah-chip ah-chip--${value} ah-chip--button`} onClick={() => setOpen(o => !o)}>
        {value}
        <span style={{ marginLeft: 4, opacity: 0.6 }}>▾</span>
      </button>
      {open && (
        <div className="ah-status-pop" role="menu">
          {window.STATUSES.map(s => (
            <button key={s} className={'ah-status-pop-item' + (s === value ? ' is-active' : '')} onClick={() => { onChange(s); setOpen(false); }}>
              <span className={`ah-chip-dot ah-chip-dot--${s}`} />
              {s}
            </button>
          ))}
        </div>
      )}
    </span>
  );
};

window.Products = Products;
window.StatusMenu = StatusMenu;
