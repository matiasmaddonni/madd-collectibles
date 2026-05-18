/* Root app — wires the shell to the page components, owns theme + nav state.
   Also owns the "jump to products with filters" hand-off from dashboard. */

const App = () => {
  const [theme, setTheme] = useState('light');
  const [route, setRoute] = useState('dashboard');
  const [productFilters, setProductFilters] = useState(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const handleNav = (id) => {
    if (id.startsWith('settings:')) {
      const sub = id.split(':')[1];
      setRoute('settings:' + sub);
    } else {
      setRoute(id);
    }
    if (id === 'products') setProductFilters(null);
  };

  const handleJumpProducts = (filters) => {
    setRoute('products');
    setProductFilters(filters);
  };

  const active = route.startsWith('settings') ? 'settings' : route;

  return (
    <div className="ah-root">
      <window.ShellHeader active={active} onNav={handleNav} theme={theme} onTheme={setTheme} />
      <main className="ah-main">
        {route === 'dashboard' && <window.Dashboard onJumpProducts={handleJumpProducts} />}
        {route === 'products'  && <window.Products initialFilters={productFilters} />}
        {route === 'proposals' && <window.Proposals />}
        {route.startsWith('settings') && <window.Settings sub={route.split(':')[1]} />}
      </main>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
