import { Status } from './ui';

const DISCLAIMER = 'Red de pruebas. Sin dinero real. No es asesoría financiera.';
const X_URL = 'https://x.com/ArepaPay';
// Sub-path for plain <img> paths when built with NEXT_BASE_PATH (GitHub Pages, D-024). Empty by default.
const BP = process.env.NEXT_PUBLIC_BASE_PATH || '';
const LOGO = `${BP}/brand/arepapay-logo.png`;
// The public test link is ALWAYS this relative page (D-024): it reads ../mvp-url.json at runtime and
// redirects to the current test tunnel. Never hardcode a tunnel URL here (T5).
const PROBAR = 'probar/';

// Truth sources: docs/PITCH.md, docs/ECONOMICS.md, docs/features/MERCHANT_FX.md, docs/features/SPLIT_PAY.md,
// config/l1/arepapaybank.fuji.json (chainId, ARPB), config/l1/mvp.fuji.json (feeBps 50 on testnet), BRAIN 2026-11-15
// (Fuji 15/15, MVP e2e 19/19 + 18/18 UI). Every example number is marked SUPUESTO (T7).

const SOLUTION = [
  {
    status: 'testnet', note: 'Fuji',
    title: 'Una cadena privada operada por el banco',
    body: 'Una red Avalanche (L1) propia. Solo pueden transaccionar billeteras habilitadas después del KYC. En la red de pruebas Fuji, la lista de permisos y el congelamiento de billeteras pasaron 15 de 15 pruebas.',
  },
  {
    status: 'testnet', note: 'MVP',
    title: 'Cobro con QR, también entre varios pagadores',
    body: 'El comercio crea un cobro con QR y varias personas pagan una misma cuenta (Split Pay): por ejemplo, 5 $ = 3 + 2. Los fondos quedan retenidos hasta cubrir el total y entonces se cobran; si el cobro vence, cada pagador retira lo suyo.',
  },
  {
    status: 'testnet', note: 'MVP',
    title: 'Saldos y montos cifrados',
    body: 'Con eERC de Avalanche, los saldos y los montos de un pago van cifrados en la cadena. En el MVP de prueba ya está la pestaña «Privado»: activas tu saldo privado, pasas dólares de prueba a privado, envías en privado y los sacas. Quién le paga a quién, y los montos que entran o salen del saldo privado, siguen siendo públicos; en esta prueba una cuenta del banco guarda la llave de auditoría y puede leer todos los montos. El tiempo de cifrado en el teléfono aún no se ha medido.',
  },
  {
    status: 'in-development',
    title: 'El comercio vende dólares, con registro',
    body: 'El comercio funciona como casa de cambio: vende USDT/USDC a sus clientes dentro de la banda de tasa del banco, y cada venta queda registrada. El contrato del registro está construido (99 pruebas) y aún no desplegado.',
  },
  {
    status: 'planned',
    title: 'Dólares reales, respaldados 1:1',
    body: 'Cada dólar en la cadena corresponderá a un USDT/USDC real bloqueado en un contrato público de la C-Chain, que cualquiera podrá verificar. El puente del banco todavía no está construido.',
  },
  {
    status: 'planned',
    title: 'Supervisión por multifirma',
    body: 'El banco podrá rastrear un caso de robo y congelar una billetera, siempre con varias firmas y cada uso registrado en la cadena. Nunca con una sola llave.',
  },
];

const ECONOMICS = [
  ['Moneda de gas ARPB', 'Solo la creación de la cadena; la emisión está desactivada', 'Gratis para el usuario. No se vende y no tiene precio', null],
  ['USDT/USDC en la cadena', 'Solo el puente del banco, 1:1 contra dólares bloqueados', 'Respaldo 1:1 comprobable', null],
  ['Saldos cifrados (eERC)', 'El dueño deposita y retira 1:1', 'Sin comisión', null],
  ['Pago al comercio (QR y Split Pay)', 'Mecanismo en el contrato, con tope fijo de 1 %', '0 % recomendado para el piloto', null],
  ['Venta de dólares del comercio', 'El comercio, dentro de la banda del banco (tasa del banco ± margen)', 'El margen queda para el comercio, por ejemplo hasta 1 %', 'SUPUESTO'],
  ['Puente de entrada y salida', 'El banco', 'Entrada gratis; salida con tarifa fija solo para cubrir el gas', 'SUPUESTO'],
  ['Colateral del comercio', 'El propio comercio, en su billetera', 'Alrededor de 100 $ (tope de la etapa C)', null],
  ['Liquidez inicial del banco', 'El banco', 'Alrededor de 1.000 $ para su mesa de cambio USD/Bs', null],
  ['Validadores', 'Cada operador paga su nodo', 'Cerca de 1,33 AVAX al mes por validador (medido)', null],
];

export default function Home() {
  return (
    <>
      {/* ---------- Header ---------- */}
      <header className="site-header">
        <div className="wrap">
          <a className="brand" href="#top" aria-label="ArepaPay — inicio">
            <img src={LOGO} alt="" width="40" height="40" />
            <b>ArepaPay</b>
          </a>
          <nav aria-label="Principal">
            <ul className="nav-links">
              <li><a href="#solucion">Solución</a></li>
              <li><a href="#probar">Probar</a></li>
              <li><a href="#economia">Economía</a></li>
              <li><a href="#plan">Plan</a></li>
              <li><a href="#faq">FAQ</a></li>
            </ul>
          </nav>
        </div>
      </header>

      <main id="top">
        {/* ---------- Hero: the announcement ---------- */}
        <section className="hero" data-feature data-status="testnet" aria-labelledby="hero-h1">
          <div className="wrap hero-grid">
            <div>
              <span className="eyebrow">Anuncio · MVP abierto en red de pruebas</span>
              <h1 id="hero-h1">ArepaPay: la cadena bancaria privada para micro y pequeños comercios</h1>
              <p className="lead">
                Una red propia sobre Avalanche, operada por un banco, donde solo entran personas verificadas.
                El comercio cobra con QR, también entre varios pagadores, y más adelante venderá dólares a sus
                clientes con cada venta registrada. Hoy el MVP corre en la red de pruebas Fuji, con dinero de prueba.
              </p>
              <p style={{ margin: '0 0 1rem' }}><Status value="testnet" note="MVP en Fuji" /></p>
              <div className="cta-row">
                <a className="btn" href={PROBAR}>Probar el MVP</a>
                <a className="btn ghost" href="#plan">Ver el plan</a>
              </div>
              <p className="disclaimer" role="note">{DISCLAIMER}</p>
            </div>
            <img className="mark" src={LOGO} alt="Logotipo de ArepaPay: una arepa sobre un mantel a cuadros" width="340" height="340" />
          </div>
        </section>

        {/* ---------- El problema ---------- */}
        <section id="problema" className="band" aria-labelledby="problema-h">
          <div className="wrap">
            <div className="section-head">
              <span className="eyebrow">El problema</span>
              <h2 id="problema-h">Los dólares digitales ya están en la calle, sin registro ni protección.</h2>
            </div>
            <div className="grid">
              <div className="card"><h3>Comercios sin respaldo</h3><p>Muchos comercios ya usan USDT/USDC por canales sin registro, sin protección si alguien roba los fondos y con los saldos a la vista en las cadenas públicas.</p></div>
              <div className="card"><h3>Bancos sin vía simple</h3><p>Los bancos quieren atender a estos comercios, pero no quieren reconstruir sus sistemas ni cambiar de red.</p></div>
              <div className="card"><h3>Bolívares y dólares a la vez</h3><p>Los clientes pagan en bolívares; el comercio quiere guardar valor en dólares y llevar sus cuentas en orden.</p></div>
            </div>
          </div>
        </section>

        {/* ---------- La solución, pieza por pieza ---------- */}
        <section id="solucion" aria-labelledby="sol-h">
          <div className="wrap">
            <div className="section-head">
              <span className="eyebrow">La solución</span>
              <h2 id="sol-h">Seis piezas, cada una con su estado real.</h2>
              <p className="lead">Una app de pagos ligera sobre una red bancaria privada. Solo lo que dice «Red de pruebas» se puede usar hoy, con dinero de prueba.</p>
            </div>
            <ol className="lines">
              {SOLUTION.map((s) => (
                <li key={s.title} data-feature data-status={s.status}>
                  <h3><span>{s.title}</span><Status value={s.status} note={s.note} /></h3>
                  <p>{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ---------- Cómo probar (testnet) ---------- */}
        <section id="probar" className="band" data-feature data-status="testnet" aria-labelledby="probar-h">
          <div className="wrap">
            <div className="section-head">
              <span className="eyebrow">Cómo probar</span>
              <h2 id="probar-h">Prueba el MVP con MetaMask <Status value="testnet" /></h2>
              <p className="lead">
                Corre en Avalanche Fuji, la red de pruebas, con dólares de prueba (tUSD) que no tienen valor.
                La red de pruebas se puede reiniciar.
              </p>
            </div>
            <div className="steps">
              <div className="step"><span className="n" aria-hidden="true"></span><div><h3>Abre el enlace en MetaMask</h3><p>En el teléfono, dentro del navegador de la app MetaMask. En la PC, con la extensión MetaMask.</p></div></div>
              <div className="step"><span className="n" aria-hidden="true"></span><div><h3>«Agregar ArepaPay L1» y «Conectar»</h3><p>La página agrega la red sola: ArepaPay L1 en Fuji, <span className="mono">chainId 77078</span>. El gas se paga en ARPB, que no tiene valor.</p></div></div>
              <div className="step"><span className="n" aria-hidden="true"></span><div><h3>«Solicitar acceso»</h3><p>Es el sustituto de prueba del KYC del banco. Durante la prueba pública se aprueba solo.</p></div></div>
              <div className="step"><span className="n" aria-hidden="true"></span><div><h3>Cobra o paga tu parte</h3><p>Como comercio, crea un cobro con QR. Como cliente, escanéalo y paga tu parte; cuando se cubre el total, el cobro se completa.</p></div></div>
            </div>
            <div className="cta-row" style={{ marginTop: '1.6rem' }}>
              <a className="btn ghost" href={PROBAR}>Abrir el MVP de prueba</a>
            </div>
            <p className="note">
              El entorno de prueba corre en una PC del equipo. Si está apagada, el enlace te lo dirá: vuelve más tarde.
              Pruebas de punta a punta del MVP: 19 de 19 por script y 18 de 18 en la interfaz real, en un navegador.
            </p>
          </div>
        </section>

        {/* ---------- Comercios como casas de cambio (L4) ---------- */}
        <section id="comercios" data-feature data-status="in-development" aria-labelledby="com-h">
          <div className="wrap">
            <div className="section-head">
              <span className="eyebrow">Para comercios</span>
              <h2 id="com-h">Comercios como casas de cambio <Status value="in-development" /></h2>
              <p className="lead">
                La panadería o la recarga de agua pone la liquidez: vende USDT/USDC a sus clientes, que le pagan en
                bolívares. Cada venta deja un registro que el banco puede conciliar.
              </p>
            </div>
            <div className="grid">
              <div className="card"><h3>Tasa oficial de la banda</h3><p>El banco fija una tasa de referencia y un margen. El contrato rechaza cualquier venta con una tasa fuera de esa banda.</p></div>
              <div className="card"><h3>Cada venta, registrada</h3><p>El comercio abre la orden, el cliente la acepta y confirma que recibió, el envío queda enlazado y el banco verifica que todo coincide.</p></div>
              <div className="card"><h3>Sin reventa ni mercado negro</h3><p>Es una regla que no se puede quebrar: los envíos entre clientes se marcan, los reincidentes se congelan y hay acuerdos legales.</p></div>
            </div>
            <p className="note">Estado: el contrato del registro de ventas está construido y tiene 99 pruebas. Todavía no está desplegado ni en el MVP.</p>
          </div>
        </section>

        {/* ---------- Cómo el dinero sigue siendo real ---------- */}
        <section id="reservas" className="band" data-feature data-status="planned" aria-labelledby="res-h">
          <div className="wrap">
            <div className="section-head">
              <span className="eyebrow">Reservas comprobables</span>
              <h2 id="res-h">Cómo el dinero sigue siendo real <Status value="planned" /></h2>
            </div>
            <div className="grid">
              <div className="card"><h3>Bloqueado 1:1</h3><p>Cada dólar en la cadena del banco corresponderá a un USDT/USDC real bloqueado en el contrato del puente, en la C-Chain pública.</p></div>
              <div className="card"><h3>Una regla verificable</h3><p>Dólares en la L1 = dólares bloqueados en la C-Chain. Cualquiera podrá comprobarlo. Si la cadena se cierra, la liquidez sigue allí y se puede devolver, aunque el banco quiebre.</p></div>
              <div className="card"><h3>Sin retiro del administrador</h3><p>El contrato del puente no tendrá ninguna vía de retiro para un administrador. Se probará con un invariante y una auditoría antes de usar dinero real.</p></div>
            </div>
            <p className="note">
              Estado honesto: el puente todavía no está construido; hoy esto es diseño. Riesgo que declaramos: el emisor
              (Tether o Circle) puede congelar el USDT/USDC bloqueado, como en cualquier lugar.
            </p>
          </div>
        </section>

        {/* ---------- Privacidad y supervisión ---------- */}
        <section id="privacidad" data-feature data-status="in-development" aria-labelledby="priv-h">
          <div className="wrap">
            <div className="section-head">
              <span className="eyebrow">Privacidad y supervisión</span>
              <h2 id="priv-h">Quién ve qué <Status value="in-development" /></h2>
            </div>
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th scope="col">Qué</th><th scope="col">Quién lo ve (diseño)</th></tr></thead>
                <tbody>
                  <tr><td>Saldos y montos</td><td data-label="Quién lo ve">Van cifrados en la cadena: nadie de afuera ve saldos ni montos. Los lee el dueño con su llave y la llave de auditoría; en la prueba actual esa llave de auditoría la tiene una cuenta del banco y puede leer todos los montos (el reparto en multifirma es lo planeado).</td></tr>
                  <tr><td>Quién le pagó a quién</td><td data-label="Quién lo ve">El banco, como cualquier banco conoce las contrapartes de sus clientes. Nadie de afuera.</td></tr>
                  <tr><td>Datos personales</td><td data-label="Quién lo ve">Nunca en la cadena. Quedan en el banco; en la cadena solo hay nivel, vencimiento y un hash.</td></tr>
                </tbody>
              </table>
            </div>
            <div className="grid" style={{ marginTop: '1.4rem' }}>
              <div className="card"><h3>Congelar sí, revertir no</h3><p>Nadie puede mover saldos sin la llave del dueño. Si alguien roba, el banco abre un caso, descifra esa billetera con la multifirma de auditoría y congela la receptora.</p></div>
              <div className="card"><h3>Nunca una sola llave</h3><p>Auditoría y congelamiento en multifirmas lideradas por el banco (propuesta: 2 de 3). Cada uso queda registrado en la cadena. Estado: planeado.</p></div>
            </div>
            <p className="note">
              En el MVP público de prueba los saldos privados ya van cifrados (pestaña «Privado», red de pruebas): los saldos y
              los montos de un pago van cifrados en la cadena, pero quién le paga a quién —y los montos que entran o salen del
              saldo privado— siguen siendo públicos. En esta prueba, una cuenta del banco guarda la llave de auditoría y puede
              leer todos los montos; el reparto en multifirma (2 de 3) es lo planeado.
            </p>
          </div>
        </section>

        {/* ---------- La economía ("tokenomics") ---------- */}
        <section id="economia" className="band" data-feature data-status="planned" aria-labelledby="eco-h">
          <div className="wrap">
            <div className="section-head">
              <span className="eyebrow">La economía</span>
              <h2 id="eco-h">Sin token para invertir. Comisiones, colateral y reservas. <Status value="planned" note="propuesta para el piloto" /></h2>
              <p className="lead">
                ArepaPay no tiene una moneda especulativa. Su economía responde cuatro preguntas: quién crea cada unidad,
                qué la respalda, cómo sale y quién cobra qué. Las decisiones finales siguen abiertas.
              </p>
            </div>
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th scope="col">Concepto</th><th scope="col">Quién lo crea o lo cobra</th><th scope="col">Cuánto</th></tr></thead>
                <tbody>
                  {ECONOMICS.map(([a, b, c, tag]) => (
                    <tr key={a}><td>{a}</td><td data-label="Quién lo crea o lo cobra">{b}</td><td data-label="Cuánto">{c}{tag ? <> <span className="supuesto">{tag}</span></> : null}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="note">
              Lectura honesta: con los topes del piloto (unos 4.000 $ en la cadena con 30 comercios, <span className="supuesto">SUPUESTO</span>)
              el piloto no es un negocio, es una prueba medida, con un costo estimado de 200 a 250 $ al mes
              (<span className="supuesto">SUPUESTO</span>). Las cifras marcadas son ejemplos, no datos ni promesas.
              En la red de pruebas actual, el contrato de Split Pay está configurado en 0,5 % con dinero de prueba, para probar el mecanismo de comisión.
            </p>
          </div>
        </section>

        {/* ---------- Plan: etapas A/B/C ---------- */}
        <section id="plan" aria-labelledby="plan-h">
          <div className="wrap">
            <div className="section-head">
              <span className="eyebrow">El plan</span>
              <h2 id="plan-h">Tres etapas. El dinero real va al final.</h2>
              <p className="lead">Una prueba pequeña de la idea, para ver cómo falla o cómo encaja en el mundo real.</p>
            </div>
            <div className="stages">
              <article className="stage" data-feature data-status="in-development">
                <h3><span>A · Red local</span><Status value="in-development" note="probada en local" /></h3>
                <p><b>Sin dinero.</b> L1 privada con lista de permisos, congelamiento y emisión desactivada; saldos cifrados eERC de punta a punta; contrato Split Pay con pruebas y auditoría independiente. Falta medir el tiempo de cifrado en un teléfono de gama baja.</p>
              </article>
              <article className="stage" data-feature data-status="testnet">
                <h3><span>B · Fuji</span><Status value="testnet" note="ahora" /></h3>
                <p><b>Dinero de prueba.</b> La L1 corre en la red de pruebas de Avalanche con acceso por solicitud, dólares de prueba, Split Pay y saldos cifrados (eERC, pestaña «Privado»). Sigue en desarrollo el registro de ventas de los comercios.</p>
              </article>
              <article className="stage" data-feature data-status="planned">
                <h3><span>C · Red principal</span><Status value="planned" /></h3>
                <p><b>Dinero real con topes:</b> alrededor de 1.000 $ de liquidez y 100 $ por comercio (una panadería, una recarga de agua). Requiere el puente construido y auditado, las multifirmas, el KYC con el banco y el marco legal.</p>
              </article>
            </div>
            <h3 className="sub">Riesgos que conocemos</h3>
            <ul className="risks">
              <li><b>La tasa.</b> Si la banda usa solo la tasa oficial y la brecha con el paralelo es grande, el comercio pierde. Por eso el plan ancla la tasa en la oficial más la mediana P2P, firmada y con límites.</li>
              <li><b>El costo.</b> Pago Móvil y Binance P2P son baratos o gratis para el comercio, y puede aplicar un IGTF de 3 %.</li>
              <li><b>Licencias.</b> La custodia y el cambio de USDT probablemente requieren operar bajo un licenciatario de SUNACRIP.</li>
              <li><b>Tecnología nueva.</b> eERC aún no tiene despliegues de producción conocidos; el tiempo de cifrado en teléfonos es el mayor riesgo.</li>
            </ul>
          </div>
        </section>

        {/* ---------- Lo que pedimos ---------- */}
        <section id="pedimos" className="band" aria-labelledby="ped-h">
          <div className="wrap">
            <div className="section-head">
              <span className="eyebrow">Lo que pedimos</span>
              <h2 id="ped-h">Buscamos un banco y comercios para probar.</h2>
            </div>
            <div className="grid">
              <div className="card">
                <h3>A un banco</h3>
                <ol className="asks">
                  <li>Operar los validadores y el relayer del puente, y hacer el KYC.</li>
                  <li>Fijar la tasa de referencia y el margen de la banda.</li>
                  <li>Designar firmantes para las multifirmas de auditoría y congelamiento.</li>
                  <li>Acompañar la revisión legal antes de cualquier dinero real.</li>
                  <li>Probar el flujo completo en la etapa B, sin dinero real.</li>
                </ol>
              </div>
              <div className="card">
                <h3>A los comercios</h3>
                <ol className="asks">
                  <li>Probar la app en la etapa B con MetaMask, sin dinero real.</li>
                  <li>Contarnos cuánto les cuesta hoy cobrar y cambiar dólares.</li>
                  <li>Si la etapa B funciona y se cumplen la auditoría y la parte legal: participar en la etapa C con hasta 100 $ propios, en su propia billetera.</li>
                </ol>
              </div>
            </div>
            <div className="cta-row" style={{ marginTop: '1.6rem' }}>
              <a className="btn ghost" href={X_URL} rel="me noopener">Escríbenos en X · @ArepaPay</a>
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
            <details><summary>¿Esto maneja dinero real hoy?</summary><p>No. Hoy es una red de pruebas con dólares de prueba sin valor. El dinero real solo entrará en la etapa C, con topes y después de una auditoría.</p></details>
            <details><summary>¿Hay un token o una moneda para invertir?</summary><p>No. ARPB es solo la moneda de gas de la red: no se vende, no tiene precio y el usuario no la compra. Los dólares de la cadena serán USDT/USDC reales bloqueados 1:1.</p></details>
            <details><summary>¿Quién controla la red?</summary><p>El banco opera los validadores y el único puente. Ver un caso o congelar una billetera requerirá varias firmas y quedará registrado.</p></details>
            <details><summary>¿Mis datos quedan en la cadena?</summary><p>No. La cadena guarda solo el nivel de verificación, el vencimiento y un hash. Los datos personales quedan en el banco.</p></details>
            <details><summary>¿Las transacciones son privadas?</summary><p>Los montos y los saldos van cifrados con eERC; eso no oculta quién le paga a quién, ni los montos que entran o salen del saldo privado. En el MVP de prueba actual ya funciona la pestaña «Privado»; en esta prueba una cuenta del banco guarda la llave de auditoría y puede leer todos los montos.</p></details>
            <details><summary>¿Por qué a veces el enlace de prueba no abre?</summary><p>El entorno de prueba corre en una PC del equipo. Si está apagada, la página te avisa; vuelve más tarde.</p></details>
          </div>
        </section>
      </main>

      {/* ---------- Footer ---------- */}
      <footer className="site-footer">
        <div className="wrap">
          <div className="cols">
            <div>
              <a className="brand" href="#top" aria-label="ArepaPay — inicio" style={{ marginBottom: '0.6rem' }}>
                <img src={LOGO} alt="" width="36" height="36" />
                <b style={{ color: 'var(--cream)' }}>ArepaPay</b>
              </a>
              <p style={{ color: 'var(--gold)', fontWeight: 700, margin: '0 0 1rem' }}>La arepa es venezolana.</p>
              <p className="disclaimer" role="note">{DISCLAIMER}</p>
            </div>
            <nav aria-label="Secciones">
              <h3 style={{ color: 'var(--gold)', fontSize: '0.8rem' }}>Secciones</h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, lineHeight: 2 }}>
                <li><a href="#solucion">Solución</a></li>
                <li><a href="#probar">Cómo probar</a></li>
                <li><a href="#economia">Economía</a></li>
                <li><a href="#plan">Plan</a></li>
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
            <small>ArepaPay · Red de pruebas · 2026. No es asesoría financiera, ni una oferta de inversión, de valores o de servicios financieros. Sin token especulativo.</small>
          </p>
        </div>
      </footer>
    </>
  );
}
