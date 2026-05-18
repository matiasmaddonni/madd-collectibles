/* Proposals — master-detail.
   List on left (filterable by source / confidence / status), detail on right. */

const useRef2 = React.useRef;

const Proposals = () => {
  const [selectedId, setSelectedId] = useState(window.PROPOSALS[0]?.id);
  const [sourceFilter, setSourceFilter] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [confidenceFilter, setConfidenceFilter] = useState('all');
  const [sort, setSort] = useState('newest');
  const [items, setItems] = useState(window.PROPOSALS);

  const filtered = items.filter(p => {
    if (sourceFilter && !p.sources.includes(sourceFilter)) return false;
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (confidenceFilter === 'high' && p.avgConfidence < 90) return false;
    if (confidenceFilter === 'med'  && (p.avgConfidence >= 90 || p.avgConfidence < 70)) return false;
    if (confidenceFilter === 'low'  && p.avgConfidence >= 70) return false;
    return true;
  }).sort((a, b) => {
    if (sort === 'newest') return b.receivedAt - a.receivedAt;
    if (sort === 'oldest') return a.receivedAt - b.receivedAt;
    if (sort === 'confidence') return b.avgConfidence - a.avgConfidence;
    return 0;
  });

  const selected = filtered.find(p => p.id === selectedId) || filtered[0];

  // Keyboard nav: j/k for next/prev
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      const i = filtered.findIndex(p => p.id === selected?.id);
      if (e.key === 'j' && i < filtered.length - 1) setSelectedId(filtered[i + 1].id);
      if (e.key === 'k' && i > 0) setSelectedId(filtered[i - 1].id);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [filtered, selected]);

  const newCount = items.filter(p => p.status === 'new').length;

  return (
    <div className="ah-page ah-page--full">
      <window.PageTitle title="Proposals" count={items.length} right={
        <div className="ah-page-meta">
          <span className="ah-mono ah-dim">Crawler · last run 47 min ago</span>
          <button className="ah-btn ah-btn--ghost ah-btn--sm">Run crawler</button>
        </div>
      } />

      <div className="ah-prop-layout">
        {/* LIST */}
        <aside className="ah-prop-list">
          <div className="ah-prop-list-toolbar">
            <div className="ah-prop-list-row">
              <FilterTabs
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { v: 'all', n: 'All', count: items.length },
                  { v: 'new', n: 'New', count: newCount },
                  { v: 'in-review', n: 'In review', count: items.filter(p => p.status === 'in-review').length },
                ]}
              />
            </div>
            <div className="ah-prop-list-row ah-prop-list-row--filters">
              <select className="ah-mini-select" value={sourceFilter || ''} onChange={e => setSourceFilter(e.target.value || null)}>
                <option value="">All sources</option>
                <option value="tamashii">tamashii</option>
                <option value="ebay">ebay</option>
              </select>
              <select className="ah-mini-select" value={confidenceFilter} onChange={e => setConfidenceFilter(e.target.value)}>
                <option value="all">Any confidence</option>
                <option value="high">≥ 90% (high)</option>
                <option value="med">70–89% (med)</option>
                <option value="low">&lt; 70% (low)</option>
              </select>
              <select className="ah-mini-select" value={sort} onChange={e => setSort(e.target.value)}>
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="confidence">Confidence ↓</option>
              </select>
            </div>
          </div>
          <div className="ah-prop-list-scroll">
            {filtered.map(p => (
              <button
                key={p.id}
                className={'ah-prop-item' + (p.id === selected?.id ? ' is-active' : '')}
                onClick={() => setSelectedId(p.id)}
              >
                <div className="ah-prop-item-top">
                  <span className="ah-prop-item-name">{p.productName}</span>
                  {p.status === 'new' && <span className="ah-tag ah-tag--new">NEW</span>}
                </div>
                <div className="ah-prop-item-mid">
                  <span className="ah-dim ah-small">{p.productLine}</span>
                </div>
                <div className="ah-prop-item-bot">
                  <span className="ah-mono ah-small">
                    {p.fieldCount} field{p.fieldCount !== 1 ? 's' : ''} · {p.imageCount} image{p.imageCount !== 1 ? 's' : ''}
                  </span>
                  <span className="ah-mono ah-small ah-dim">{window.formatRelative(p.receivedAt)}</span>
                </div>
                <div className="ah-prop-item-foot">
                  <span className="ah-prop-sources">
                    {p.sources.map(s => <span key={s} className="ah-source-pill">{s}</span>)}
                  </span>
                  <ConfidenceMeter value={p.avgConfidence} />
                </div>
              </button>
            ))}
            {!filtered.length && (
              <div className="ah-empty ah-empty--padded">
                No proposals match these filters.
              </div>
            )}
          </div>
          <div className="ah-prop-list-foot">
            <span className="ah-mono ah-small ah-dim">↑↓ or j/k to navigate</span>
          </div>
        </aside>

        {/* DETAIL */}
        <main className="ah-prop-detail">
          {selected ? <ProposalDetail key={selected.id} prop={selected} /> : (
            <div className="ah-empty ah-empty--padded">Select a proposal from the list.</div>
          )}
        </main>
      </div>
    </div>
  );
};

const FilterTabs = ({ value, onChange, options }) => (
  <div className="ah-filter-tabs">
    {options.map(o => (
      <button key={o.v} className={'ah-filter-tab' + (value === o.v ? ' is-active' : '')} onClick={() => onChange(o.v)}>
        {o.n}
        <span className="ah-filter-tab-count">{o.count}</span>
      </button>
    ))}
  </div>
);

const ConfidenceMeter = ({ value }) => {
  const cls = value >= 90 ? 'high' : value >= 70 ? 'med' : 'low';
  return (
    <span className={`ah-conf ah-conf--${cls}`} title={`${value}% confidence`}>
      <span className="ah-conf-track"><span className="ah-conf-fill" style={{ width: `${value}%` }} /></span>
      <span className="ah-mono ah-small">{value}%</span>
    </span>
  );
};

const ProposalDetail = ({ prop }) => {
  const [fieldStates, setFieldStates] = useState(() =>
    prop.fields.reduce((a, f) => ({ ...a, [f.key]: 'pending' }), {})
  );
  const setField = (k, v) => setFieldStates(s => ({ ...s, [k]: v }));

  const allApproved = prop.fields.every(f => fieldStates[f.key] === 'approved');
  const anyApproved = prop.fields.some(f => fieldStates[f.key] === 'approved');

  return (
    <div className="ah-prop-detail-inner">
      {/* Detail header */}
      <div className="ah-prop-detail-head">
        <div>
          <div className="ah-prop-detail-tag">
            <span className="ah-tag ah-tag--draft">NEW DRAFT</span>
            <span className="ah-dim ah-small">{prop.productLine}</span>
          </div>
          <h2 className="ah-prop-detail-title">{prop.productName}</h2>
        </div>
        <div className="ah-prop-detail-actions">
          <button className="ah-btn ah-btn--ghost ah-btn--sm">← Back</button>
          <button className="ah-btn ah-btn--ghost ah-btn--sm">Edit product</button>
        </div>
      </div>

      {/* Publish panel */}
      <div className="ah-publish">
        <div className="ah-publish-head">
          <div>
            <div className="ah-publish-title">Publish to storefront</div>
            <div className="ah-publish-sub">
              Approve fields + images first, then publish to flip <code className="ah-code">draft</code> → <code className="ah-code">available</code>.
            </div>
          </div>
          <button className={'ah-btn ah-btn--publish' + (allApproved ? '' : ' is-disabled')} disabled={!allApproved}>
            Publish
          </button>
        </div>
        <div className="ah-publish-checks">
          <Check ok label="Name set" />
          <Check ok={anyApproved} label="At least one approved primary image" />
          <Check ok={anyApproved} label="Price &gt; 0" />
          <Check ok={anyApproved} label="Description set (recommended)" soft />
        </div>
        {!allApproved && (
          <div className="ah-publish-note">
            {prop.fields.filter(f => fieldStates[f.key] === 'pending').length} pending field proposal(s) · {prop.imageCount} candidate image(s).
            Approve or discard them below.
          </div>
        )}
      </div>

      {/* Bulk actions */}
      <div className="ah-prop-bulk">
        <button className="ah-btn ah-btn--sm ah-btn--ghost-green" onClick={() => {
          const next = {}; prop.fields.forEach(f => { next[f.key] = 'approved'; }); setFieldStates(next);
        }}>Approve all fields</button>
        <button className="ah-btn ah-btn--sm ah-btn--ghost" onClick={() => {
          const next = {}; prop.fields.forEach(f => { next[f.key] = 'discarded'; }); setFieldStates(next);
        }}>Discard all fields</button>
        <div className="ah-toolbar-spacer" />
        <button className="ah-btn ah-btn--sm ah-btn--danger-ghost">Discard everything (fields + images)</button>
      </div>

      {/* Fields */}
      <div className="ah-section-head">
        <h3 className="ah-h3">Field proposals</h3>
        <span className="ah-dim ah-small">
          {Object.values(fieldStates).filter(v => v === 'approved').length} approved ·
          {' '}{Object.values(fieldStates).filter(v => v === 'discarded').length} discarded ·
          {' '}{Object.values(fieldStates).filter(v => v === 'pending').length} pending
        </span>
      </div>
      <div className="ah-field-list">
        {prop.fields.map(f => (
          <FieldRow key={f.key} field={f} state={fieldStates[f.key]} onSet={v => setField(f.key, v)} />
        ))}
      </div>

      {/* Images */}
      {prop.imageCount > 0 && (
        <>
          <div className="ah-section-head">
            <h3 className="ah-h3">Image candidates</h3>
            <span className="ah-dim ah-small">{prop.imageCount} found · click to approve</span>
          </div>
          <div className="ah-img-grid">
            {Array.from({ length: prop.imageCount }, (_, i) => (
              <ImageCandidate key={i} index={i + 1} />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const Check = ({ ok, label, soft }) => (
  <div className={'ah-check' + (ok ? ' is-ok' : '') + (soft ? ' is-soft' : '')}>
    <span className="ah-check-mark">{ok ? '✓' : '○'}</span>
    <span>{label}</span>
  </div>
);

const FieldRow = ({ field, state, onSet }) => {
  const cls = field.confidence >= 90 ? 'high' : field.confidence >= 70 ? 'med' : 'low';
  return (
    <div className={'ah-field' + (state === 'approved' ? ' is-approved' : '') + (state === 'discarded' ? ' is-discarded' : '')}>
      <div className="ah-field-head">
        <div className="ah-field-meta">
          <span className="ah-tag ah-tag--key">{field.key.toUpperCase()}</span>
          <span className="ah-mono ah-small">{field.source}</span>
          <span className={`ah-conf ah-conf--${cls}`}>
            <span className="ah-conf-track"><span className="ah-conf-fill" style={{ width: `${field.confidence}%` }} /></span>
            <span className="ah-mono ah-small">{field.confidence}%</span>
          </span>
          <a href="#" className="ah-link ah-small">source ↗</a>
        </div>
        {state === 'approved' && <span className="ah-tag ah-tag--ok">APPROVED</span>}
        {state === 'discarded' && <span className="ah-tag ah-tag--off">DISCARDED</span>}
      </div>
      <div className="ah-field-diff">
        <div className="ah-field-col">
          <div className="ah-field-col-label">CURRENT</div>
          <pre className="ah-field-val">{field.current || <span className="ah-dim">(empty)</span>}</pre>
        </div>
        <div className="ah-field-col ah-field-col--proposed">
          <div className="ah-field-col-label">PROPOSED</div>
          <pre className="ah-field-val ah-field-val--proposed">{field.proposed}</pre>
        </div>
      </div>
      {field.note && <div className="ah-field-note">{field.note}</div>}
      <div className="ah-field-actions">
        <button className="ah-btn ah-btn--sm ah-btn--ok" onClick={() => onSet('approved')}>Approve</button>
        <button className="ah-btn ah-btn--sm ah-btn--ghost" onClick={() => onSet('discarded')}>Discard</button>
        {state !== 'pending' && (
          <button className="ah-btn ah-btn--sm ah-btn--ghost" onClick={() => onSet('pending')}>Reset</button>
        )}
      </div>
    </div>
  );
};

const ImageCandidate = ({ index }) => {
  const [state, setState] = useState('pending');
  return (
    <div className={'ah-img ' + (state === 'approved' ? 'is-approved' : '') + (state === 'discarded' ? ' is-discarded' : '')}>
      <div className="ah-img-frame">
        <span className="ah-img-label">img {index}</span>
      </div>
      <div className="ah-img-actions">
        <button className={'ah-btn ah-btn--xs ' + (state === 'approved' ? 'ah-btn--ok' : 'ah-btn--ghost-green')} onClick={() => setState(state === 'approved' ? 'pending' : 'approved')}>
          {state === 'approved' ? '✓ Primary' : 'Approve'}
        </button>
        <button className="ah-btn ah-btn--xs ah-btn--ghost" onClick={() => setState('discarded')}>Discard</button>
      </div>
    </div>
  );
};

window.Proposals = Proposals;
