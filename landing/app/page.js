import { Feature, Status } from './ui';

const DISCLAIMER = 'Red de pruebas. Sin dinero real. No es asesoría financiera.';
const X_URL = 'https://x.com/ArepaPay';
// Sub-path for plain <img> paths when built with NEXT_BASE_PATH (GitHub Pages, D-024). Empty by default.
const BP = process.env.NEXT_PUBLIC_BASE_PATH || '';
const LOGO = `${BP}/brand/arepapay-logo.png`;
// The public test link is ALWAYS this relative page (D-024): it reads ../mvp-url.json at runtime and
// redirects to the current test tunnel. Never hardcode a tunnel URL here (T5).
const PROBAR = 'probar/';

// D-036 (L8, user 2026-11-16: "more simple and less text"): target <= 250 visible words.
// Truth sources: app/README.md (Use; Stores as payment contacts, D-034; Saldo privado, D-032),
// config/l1/mvp.fuji.json feeBps 50 (= 0,5 %, shared by MerchantPay), BRAIN e2e 23/23 LIVE (D-034), D-032 audit key.
// The long pitch (reserves, economics, stages, risks, asks) lives in docs/PITCH.md and docs/ECONOMICS.md.

export default function Home() {
  return (
    <>
      <header className="site-header">
        <div className="wrap">
          <a className="brand" href="#top" aria-label="ArepaPay, inicio">
            <img src={LOGO} alt="" width="40" height="40" />
            <b>ArepaPay</b>
          </a>
          <nav aria-label="Principal">
            <ul className="nav-links">
              <li><a href="#probar">Cómo probar</a></li>
              <li><a href="#faq">Preguntas</a></li>
            </ul>
          </nav>
        </div>
      </header>

      <main id="top">
        <section className="hero" data-feature data-status="testnet" aria-labelledby="hero-h1">
          <div className="wrap hero-grid">
            <div>
              <h1 id="hero-h1">Pagos con QR para micro y pequeños comercios</h1>
              <p className="lead">
                Una red privada sobre Avalanche: solo pagan las billeteras aprobadas.
              </p>
              <p style={{ margin: '0 0 1rem' }}><Status value="testnet" /></p>
              <div className="cta-row">
                <a className="btn" href={PROBAR}>Probar el MVP</a>
              </div>
              <p className="disclaimer" role="note">{DISCLAIMER}</p>
            </div>
            <img className="mark" src={LOGO} alt="Logotipo de ArepaPay: una arepa sobre un mantel a cuadros" width="340" height="340" />
          </div>
        </section>

        <section id="que" aria-labelledby="que-h">
          <div className="wrap">
            <h2 id="que-h" className="sr-only">Qué puedes hacer</h2>
            <div className="grid">
              <Feature title="Cobra con QR" status="testnet">
                Crea un cobro; una o varias personas lo pagan.
              </Feature>
              <Feature title="Paga a un comercio de la lista" status="testnet">
                Panadería, carrito de perros, recarga de agua: todos los comercios registrados están en Pagar. Comisión: 0,5 %.
              </Feature>
              <Feature title="Saldo privado" status="testnet">
                En «Privado», tu saldo y tus montos van cifrados.
              </Feature>
            </div>
            <p className="note" data-feature data-status="testnet">
              Se ve quién paga a quién y lo que entra o sale de «Privado». En la prueba, una cuenta del banco tiene la
              llave de auditoría y puede leer los montos.
            </p>
          </div>
        </section>

        <section id="probar" className="band" data-feature data-status="testnet" aria-labelledby="probar-h">
          <div className="wrap">
            <h2 id="probar-h">Cómo probar</h2>
            <div className="steps">
              <div className="step"><span className="n" aria-hidden="true"></span><div><h3>Abre el enlace en MetaMask</h3><p>Teléfono: el navegador de MetaMask. PC: la extensión.</p></div></div>
              <div className="step"><span className="n" aria-hidden="true"></span><div><h3>Agrega la red y conecta</h3><p>La página agrega la red sola.</p></div></div>
              <div className="step"><span className="n" aria-hidden="true"></span><div><h3>Solicita acceso</h3><p>KYC de prueba: se aprueba solo y recibes dólares de prueba.</p></div></div>
            </div>
            <div className="cta-row" style={{ marginTop: '1.6rem' }}>
              <a className="btn ghost" href={PROBAR}>Abrir el MVP</a>
            </div>
          </div>
        </section>

        <section id="faq" className="faq" aria-labelledby="faq-h">
          <div className="wrap">
            <h2 id="faq-h">Preguntas</h2>
            <details><summary>¿Hay dinero real?</summary><p>No. Son dólares de prueba sin valor. El dinero real está planeado para más adelante, con topes y auditoría.</p></details>
            <details><summary>¿Hay un token para invertir?</summary><p>No. ARPB solo paga el gas: no se vende ni tiene precio.</p></details>
            <details><summary>¿Por qué el enlace no abre?</summary><p>La prueba corre en una PC del equipo. Si está apagada, la página te avisa: vuelve más tarde.</p></details>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="wrap">
          <a className="brand" href="#top" aria-label="ArepaPay, inicio" style={{ marginBottom: '0.6rem' }}>
            <img src={LOGO} alt="" width="36" height="36" />
            <b style={{ color: 'var(--cream)' }}>ArepaPay</b>
          </a>
          <p style={{ color: 'var(--gold)', fontWeight: 700, margin: '0 0 1rem' }}>La arepa es venezolana.</p>
          <p className="disclaimer" role="note">{DISCLAIMER}</p>
          <p><a href={X_URL} rel="me noopener">X · @ArepaPay</a></p>
        </div>
      </footer>
    </>
  );
}
