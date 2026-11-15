import { Status, Feature } from './ui';

const DISCLAIMER = 'Red de pruebas. Sin dinero real. No es asesoría financiera.';
const X_URL = 'https://x.com/ArepaPay';

export default function Home() {
  return (
    <>
      {/* ---------- Header ---------- */}
      <header className="site-header">
        <div className="wrap">
          <a className="brand" href="#top" aria-label="ArepaPay — inicio">
            <img src="/brand/arepapay-logo.png" alt="" width="40" height="40" />
            <b>ArepaPay</b>
          </a>
          <nav aria-label="Principal">
            <ul className="nav-links">
              <li><a href="#como-funciona">Cómo funciona</a></li>
              <li><a href="#comercios">Comercios</a></li>
              <li><a href="#seguridad">Seguridad</a></li>
              <li><a href="#hoja-de-ruta">Hoja de ruta</a></li>
              <li><a href="#faq">FAQ</a></li>
            </ul>
          </nav>
        </div>
      </header>

      <main id="top">
        {/* ---------- Hero ---------- */}
        <section className="hero" data-feature data-status="in-development" aria-labelledby="hero-h1">
          <div className="wrap hero-grid">
            <div>
              <span className="eyebrow">App de pagos y banca · Venezuela</span>
              <h1 id="hero-h1">Paga al comercio de la esquina. En su propia red.</h1>
              <p className="lead">
                ArepaPay será una app de pagos y banca sobre su propia red Avalanche permisada, en
                red de pruebas. El comercio depositará un colateral real en USDT/USDC a través del
                puente del banco; tú pagarás con el precio en bolívares.
              </p>
              <p style={{ margin: '0 0 1rem' }}><Status value="in-development" /></p>
              <div className="cta-row">
                <a className="btn" href="#como-funciona">Cómo funciona</a>
                <a className="btn ghost" href="#hoja-de-ruta">Ver hoja de ruta</a>
              </div>
              <p className="disclaimer" role="note">{DISCLAIMER}</p>
            </div>
            <img className="mark" src="/brand/arepapay-logo.png" alt="Logotipo de ArepaPay: una arepa sobre un mantel a cuadros" width="340" height="340" />
          </div>
        </section>

        {/* ---------- El problema ---------- */}
        <section id="problema" aria-labelledby="problema-h">
          <div className="wrap">
            <div className="section-head">
              <span className="eyebrow">El problema</span>
              <h2 id="problema-h">Pagar montos pequeños en dólares es incómodo.</h2>
            </div>
            <div className="grid">
              <div className="card"><h3>Bolívares contra dólares</h3><p>Mucha gente ahorra en USDT, pero pagar el pan o la recarga de agua obliga a cambiar de un lado a otro, con comisiones y confusión de tasas.</p></div>
              <div className="card"><h3>Pocos comercios lo aceptan</h3><p>Enviar USDT a mano es lento y arriesgado: direcciones largas, sin recibos y sin forma simple de llevar la cuenta.</p></div>
              <div className="card"><h3>Sin respaldo ni reglas</h3><p>No hay una red pensada para el comercio de barrio: con identidad verificada, límites claros y una banca detrás.</p></div>
            </div>
          </div>
        </section>

        {/* ---------- Cómo funciona ---------- */}
        <section id="como-funciona" className="band" data-feature data-status="in-development" aria-labelledby="cf-h">
          <div className="wrap">
            <div className="section-head">
              <span className="eyebrow">Cómo funcionará</span>
              <h2 id="cf-h">Pagar será escanear y confirmar <Status value="in-development" /></h2>
              <p className="lead">Así está pensado el flujo. Todavía está en desarrollo; nada de esto opera aún.</p>
            </div>
            <div className="steps">
              <div className="step"><span className="n" aria-hidden="true"></span><div><h3>Verifica tu identidad</h3><p>Te registrarás con el banco. Solo personas verificadas podrán usar la red (KYC).</p></div></div>
              <div className="step"><span className="n" aria-hidden="true"></span><div><h3>Escanea el QR del comercio</h3><p>Verás el precio en bolívares; la app calculará el monto en USDT con la tasa del banco.</p></div></div>
              <div className="step"><span className="n" aria-hidden="true"></span><div><h3>Confirma el pago</h3><p>El comercio recibirá USDT en la red y tú tendrás tu recibo. Los montos y comisiones se validarán del lado del servidor.</p></div></div>
            </div>
          </div>
        </section>

        {/* ---------- Lo que estamos construyendo (features) ---------- */}
        <section id="features" aria-labelledby="feat-h">
          <div className="wrap">
            <div className="section-head">
              <span className="eyebrow">Lo que estamos construyendo</span>
              <h2 id="feat-h">Las piezas, con su estado real.</h2>
              <p className="lead">Cada pieza lleva su etiqueta: en desarrollo o planeada. No afirmamos nada como terminado.</p>
            </div>
            <div className="grid">
              <Feature title="Cuenta verificada (KYC)" status="planned" id="kyc">
                KYC obligatorio para todos. La red será permisada: solo personas verificadas por el banco podrán registrarse. En la cadena vivirán solo el nivel, el vencimiento y un hash — tus datos personales nunca estarán on-chain.
              </Feature>
              <Feature title="Saldos cifrados" status="planned" note="en evaluación">
                Los saldos y las transferencias se cifrarán con el SDK eERC. Oculta los montos y los saldos — no quién le paga a quién. Es una decisión de diseño en evaluación, no una promesa.
              </Feature>
              <Feature title="Red propia (L1)" status="in-development">
                Correrá sobre su propia red Avalanche, permisada y en pruebas. El banco operará los validadores y el único puente hacia USDT/USDC. La administración vivirá en multisigs, nunca en una sola llave.
              </Feature>
              <Feature title="Puente del banco" status="planned">
                Un solo puente, operado por el banco, hacia USDT/USDC en C-Chain. El valor en la red estará respaldado uno a uno por el colateral bloqueado fuera de ella.
              </Feature>
              <Feature title="Banca y back office" status="planned">
                Cuentas, libro mayor, estados, límites y registro de auditoría — una operación con forma de banco para el comercio pequeño, incluida la ayuda contable.
              </Feature>
              <Feature title="Recompensas" status="planned" note="en evaluación">
                Rifas y minutos de WiFi financiados solo con comisiones, nunca con dinero de la nada. En evaluación para una fase posterior.
              </Feature>
            </div>
          </div>
        </section>

        {/* ---------- Comercios ---------- */}
        <section id="comercios" data-feature data-status="planned" aria-labelledby="com-h">
          <div className="wrap">
            <div className="section-head">
              <span className="eyebrow">Para comercios</span>
              <h2 id="com-h">El comercio de barrio es el centro <Status value="planned" /></h2>
            </div>
            <div className="grid">
              <div className="card"><h3>Pones tu colateral</h3><p>Una panadería o un puesto de recarga de agua depositará su propio colateral (alrededor de 100 $ en pruebas) a través del puente del banco.</p></div>
              <div className="card"><h3>Eres el puente entre efectivo y USDT</h3><p>Recibirás pagos en USDT dentro de la red y servirás de punto de cambio entre efectivo y dólares para tu zona.</p></div>
              <div className="card"><h3>Llevas tus cuentas</h3><p>Verás recibos, estados y una exportación para impuestos. La banca detrás te dará reglas y respaldo.</p></div>
            </div>
          </div>
        </section>

        {/* ---------- Seguridad y transparencia ---------- */}
        <section id="seguridad" className="band" aria-labelledby="seg-h">
          <div className="wrap">
            <div className="section-head">
              <span className="eyebrow">Seguridad y transparencia</span>
              <h2 id="seg-h">Lo que nos comprometemos a hacer.</h2>
              <p className="lead">Promesas de método, no sellos. Las etiquetas de estado cambiarán solo cuando el código lo demuestre.</p>
            </div>
            <div className="grid">
              <div className="card"><h3>Pruebas primero</h3><p>El dinero real solo entrará en una etapa posterior, con topes (~1.000 $ de liquidez inicial, ~100 $ por comercio) y después de auditar.</p></div>
              <div className="card"><h3>Contratos abiertos</h3><p>Publicaremos los contratos cuando se desplieguen, para que cualquiera los revise.</p></div>
              <div className="card"><h3>Auditoría antes del dinero real</h3><p>Ningún valor real se moverá sin una auditoría previa. No diremos «auditado» hasta que sea cierto.</p></div>
              <div className="card"><h3>Supervisión por multisig</h3><p>Ver un caso o congelar fondos requerirá varias firmas y quedará registrado en la cadena. Nunca una sola llave.</p></div>
            </div>
          </div>
        </section>

        {/* ---------- Hoja de ruta ---------- */}
        <section id="hoja-de-ruta" aria-labelledby="hr-h">
          <div className="wrap">
            <div className="section-head">
              <span className="eyebrow">Hoja de ruta</span>
              <h2 id="hr-h">Por dónde vamos.</h2>
              <p className="lead">Un proyecto de prueba: ver cómo la idea falla o encaja en el mundo real.</p>
            </div>
            <div className="phases">
              <div className="phase"><span className="ph">Fase 1</span><b>Red privada en pruebas, con listas de acceso y freno de emergencia.</b><Status value="in-development" /></div>
              <div className="phase"><span className="ph">Fase 2</span><b>Saldos cifrados con eERC, medidos en un teléfono de gama baja.</b><Status value="in-development" /></div>
              <div className="phase"><span className="ph">Fase 3</span><b>Puente del banco y colateral de los comercios.</b><Status value="planned" /></div>
              <div className="phase"><span className="ph">Fase 4</span><b>KYC obligatorio y back office del banco.</b><Status value="planned" /></div>
              <div className="phase"><span className="ph">Fase 5</span><b>Pagos a comercios de punta a punta, en red de pruebas.</b><Status value="planned" /></div>
              <div className="phase"><span className="ph">Fase 6</span><b>Piloto real con topes y comercios reales.</b><Status value="planned" /></div>
            </div>
          </div>
        </section>

        {/* ---------- FAQ ---------- */}
        <section id="faq" className="faq" aria-labelledby="faq-h">
          <div className="wrap">
            <div className="section-head">
              <span className="eyebrow">Preguntas</span>
              <h2 id="faq-h">Lo que seguro te preguntas.</h2>
            </div>
            <details><summary>¿Esto maneja dinero real hoy?</summary><p>No. Hoy es una red de pruebas, sin dinero real. El dinero real solo entrará en una etapa posterior, con topes y auditoría.</p></details>
            <details><summary>¿Qué es una red permisada?</summary><p>Una red donde solo participan personas y validadores autorizados. El banco operará los validadores; solo personas con KYC podrán registrarse.</p></details>
            <details><summary>¿Mis datos quedarán en la cadena?</summary><p>No. La cadena guardará solo el nivel de verificación, el vencimiento y un hash. Tus datos personales se guardarán cifrados fuera de la cadena.</p></details>
            <details><summary>¿Las transacciones serán privadas?</summary><p>Los montos y los saldos se cifrarán con eERC. No oculta quién le paga a quién, y lo decimos con claridad. Es un diseño en evaluación.</p></details>
            <details><summary>¿Quién controla la red?</summary><p>El banco operará los validadores y el único puente. Las decisiones sensibles (ver un caso, congelar) requerirán varias firmas en un multisig y quedarán registradas.</p></details>
          </div>
        </section>
      </main>

      {/* ---------- Footer ---------- */}
      <footer className="site-footer">
        <div className="wrap">
          <div className="cols">
            <div>
              <a className="brand" href="#top" aria-label="ArepaPay — inicio" style={{ marginBottom: '0.6rem' }}>
                <img src="/brand/arepapay-logo.png" alt="" width="36" height="36" />
                <b style={{ color: 'var(--cream)' }}>ArepaPay</b>
              </a>
              <p style={{ color: 'var(--gold)', fontWeight: 700, margin: '0 0 1rem' }}>La arepa es venezolana.</p>
              <p className="disclaimer" role="note">{DISCLAIMER}</p>
            </div>
            <nav aria-label="Secciones">
              <h3 style={{ color: 'var(--gold)', fontSize: '0.8rem' }}>Secciones</h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, lineHeight: 2 }}>
                <li><a href="#como-funciona">Cómo funciona</a></li>
                <li><a href="#comercios">Comercios</a></li>
                <li><a href="#seguridad">Seguridad</a></li>
                <li><a href="#hoja-de-ruta">Hoja de ruta</a></li>
                <li><a href="#faq">FAQ</a></li>
              </ul>
            </nav>
            <div>
              <h3 style={{ color: 'var(--gold)', fontSize: '0.8rem' }}>Síguenos</h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, lineHeight: 2 }}>
                <li><a href={X_URL} rel="me noopener">X · @ArepaPay</a></li>
              </ul>
            </div>
          </div>
          <p style={{ marginTop: '2rem' }}>
            <small>ArepaPay · Red de pruebas · 2026. No es asesoría financiera, ni una oferta de valores o de servicios financieros.</small>
          </p>
        </div>
      </footer>
    </>
  );
}
