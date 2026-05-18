/* Settings — folds Brands / Lines / Series into a single tab with sub-nav.
   These are rarely edited; goal is clarity + compactness. */

const Settings = ({ sub }) => {
  const [active, setActive] = useState(sub || 'brands');
  useEffect(() => { if (sub) setActive(sub); }, [sub]);

  return (
    <div className="ah-page">
      <window.PageTitle title="Settings" right={null} />
      <div className="ah-subnav">
        {[
          { v: 'brands', n: 'Brands', count: window.BRANDS.length },
          { v: 'lines',  n: 'Lines',  count: window.LINES.length },
          { v: 'series', n: 'Series', count: window.SERIES_DATA.length },
        ].map(t => (
          <button key={t.v} className={'ah-subnav-item' + (active === t.v ? ' is-active' : '')} onClick={() => setActive(t.v)}>
            {t.n}
            <span className="ah-subnav-count">{t.count}</span>
          </button>
        ))}
      </div>

      {active === 'brands' && <TaxonomyEditor
        title="Brands"
        items={window.BRANDS}
        columns={['name', 'slug']}
        addLabel="Add new brand"
      />}
      {active === 'lines' && <TaxonomyEditor
        title="Product lines"
        items={window.LINES.map(l => ({ name: l.name, slug: l.slug, brand: l.brand }))}
        columns={['name', 'slug', 'brand']}
        addLabel="Add new line"
        selectColumns={{ brand: window.BRANDS.map(b => b.name) }}
      />}
      {active === 'series' && <TaxonomyEditor
        title="Series"
        items={window.SERIES_DATA}
        columns={['name', 'slug', 'line']}
        addLabel="Add new series"
        selectColumns={{ line: window.LINES.map(l => l.name) }}
      />}
    </div>
  );
};

const TaxonomyEditor = ({ title, items, columns, addLabel, selectColumns = {} }) => (
  <Card>
    <div className="ah-card-head">
      <div>
        <div className="ah-card-title">{title}</div>
        <div className="ah-card-sub">{items.length} entries · inline edit, save per row</div>
      </div>
    </div>

    <div className="ah-tax-add">
      <div className="ah-card-sub" style={{ marginBottom: 8 }}>{addLabel}</div>
      <div className="ah-tax-add-row">
        {columns.map(c => (
          <div key={c} className="ah-tax-field">
            <label>{c}</label>
            {selectColumns[c] ? (
              <select><option>— select —</option>{selectColumns[c].map(o => <option key={o}>{o}</option>)}</select>
            ) : <input type="text" />}
          </div>
        ))}
        <button className="ah-btn ah-btn--primary ah-btn--sm">Add</button>
      </div>
    </div>

    <div className="ah-tax-list">
      {items.map((it, i) => (
        <div key={i} className="ah-tax-row">
          {columns.map(c => (
            <div key={c} className="ah-tax-cell">
              <span className="ah-tax-cell-label">{c}</span>
              {selectColumns[c] ? (
                <select defaultValue={it[c]}>{selectColumns[c].map(o => <option key={o}>{o}</option>)}</select>
              ) : <input type="text" defaultValue={it[c]} />}
            </div>
          ))}
          <div className="ah-tax-row-actions">
            <button className="ah-link">Save</button>
            <button className="ah-link ah-link--danger">Delete</button>
          </div>
        </div>
      ))}
    </div>
  </Card>
);

window.Settings = Settings;
