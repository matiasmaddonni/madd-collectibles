/* Inlined script runs as the parser hits it, before paint. Sets data-theme on
   the admin-root container (already opened in the parent layout) from
   localStorage.adminTheme, falling back to prefers-color-scheme. Avoids FOUC.
   Needs the per-request CSP nonce so strict-dynamic permits it. */

const code = `(function(){try{var el=document.getElementById('admin-root');if(!el)return;var t=localStorage.getItem('adminTheme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}el.setAttribute('data-theme',t);}catch(e){}})();`;

export function ThemeBootstrap({ nonce }: { nonce?: string }) {
  return (
    <script
      nonce={nonce}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: code }}
    />
  );
}
