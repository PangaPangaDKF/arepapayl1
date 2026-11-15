# ArepaPay: la cadena bancaria privada para micro y pequeños comercios

Versión 1.0 · 2026-11-15 · D-021 · Para bancos y comercios · Fuente de cada dato: `docs/ECONOMICS.md`, `docs/ARCHITECTURE.md`,
`docs/features/MERCHANT_FX.md`, `docs/features/SPLIT_PAY.md`, `docs/DECISIONS.md`, `docs/research/market_landscape.md`

> **Red de prueba (testnet). Hoy no se usa dinero real.** Esto no es una oferta de inversión. ArepaPay no tiene token
> especulativo y no promete rendimientos, precios ni ganancias. Las cifras marcadas como **SUPUESTO** son ejemplos, no datos.

## 1. El problema
- Muchos comercios en Venezuela ya usan dólares digitales (USDT/USDC), pero por canales sin registro, sin protección si alguien
  roba los fondos y con los saldos a la vista de cualquiera en las cadenas públicas.
- Los bancos quieren atender a estos comercios, pero no quieren reconstruir sus sistemas ni cambiar de red.
- Los clientes pagan en bolívares; el comercio quiere guardar valor en dólares y llevar sus cuentas en orden.

## 2. La solución en 5 líneas
1. Una **cadena privada (Avalanche L1) operada por el banco**: solo entran personas con KYC hecho en el banco.
2. Los **dólares son reales**: USDT/USDC bloqueados 1:1 en un contrato público, que cualquiera puede verificar.
3. **Saldos y montos cifrados** (eERC de Avalanche): nadie de afuera los ve; el dueño guarda su propia llave.
4. El comercio **cobra con QR y precios en bolívares**, también entre varios pagadores (Split Pay), y **vende dólares** a sus
   clientes dentro de la banda del banco, con cada venta registrada.
5. **Supervisión por multifirma**: el banco puede rastrear un caso de robo y congelar una billetera, nunca con una sola llave.

## 3. Por qué una L1 privada operada por el banco
- **El banco no cambia su núcleo**: corre los validadores, el puente y el KYC, y conecta su sistema actual por una API.
- **Privacidad de banco**: sin RPC público, nadie de afuera puede leer la cadena. Dentro del banco, montos y saldos siguen cifrados.
- **Solo personas reales**: la lista de permisos de la cadena (txAllowList) solo deja transaccionar billeteras con KYC. Probado en
  red local: una billetera sin permiso es rechazada, y se puede habilitar y congelar de nuevo (15/15 pruebas, D-008).
- **Sin dinero creado de la nada**: la emisión de la moneda de gas está desactivada (probado, D-008). Los dólares solo llegan por
  el puente, contra dólares reales bloqueados.
- **Gas gratis para el usuario**: una estación de gas pagada desde la creación de la cadena recarga las billeteras; nadie compra
  la moneda de gas, y no se vende.

## 4. Cómo el dinero sigue siendo real (reservas comprobables)
- Cada dólar en la cadena del banco corresponde a un USDT/USDC real **bloqueado en el contrato del puente en la C-Chain pública**.
- Regla verificable: **dólares en la L1 = dólares bloqueados en la C-Chain**. Cualquiera puede comprobarlo.
- En palabras del usuario: "si se cierra la cadena, la liquidez está allí dentro y no en el banco", y se puede devolver "aunque el
  banco quiebre mañana".
- Condición: el contrato del puente **no debe tener ninguna vía de retiro para un administrador**. Se probará con un invariante y
  una auditoría antes de usar dinero real.
- **Estado honesto:** el puente **todavía no está construido** (spike S6, planificado). Hoy esto es diseño.
- Riesgo que declaramos: el emisor (Tether o Circle) puede congelar el USDT/USDC bloqueado en la C-Chain, como en cualquier lugar.

## 5. Privacidad y supervisión
| Qué | Quién lo ve |
|---|---|
| Saldos y montos | Nadie de afuera; el banco tampoco (cifrados). Solo el dueño, y la llave de auditoría por caso |
| Quién le pagó a quién | El banco, como cualquier banco conoce las contrapartes de sus clientes; nadie de afuera |
| Datos personales | Nunca en la cadena; quedan en el banco (en la cadena solo nivel, vencimiento y un hash) |

- **"Si alguien mueve tus fondos, el banco te puede decir"**: el cliente reporta, el banco abre un caso, la multifirma de auditoría
  descifra los movimientos de esa billetera, la multifirma de congelamiento congela la billetera receptora, y sigue el proceso legal.
- **Congelar sí, revertir no** (por defecto): nadie puede mover saldos sin la llave del dueño.
- **Sin una sola llave**: auditoría y congelamiento en multifirmas lideradas por el banco (propuesta 2 de 3; los firmantes los
  decide el usuario, Q9). Cada uso queda registrado en la cadena.
- **Sin reventa ni mercado negro (regla que no se puede quebrar):** la única salida es el puente del banco; el contrato rechaza
  tasas fuera de la banda del banco; cada envío de comercio a cliente debe corresponder a una venta registrada o a un pago; los
  envíos entre clientes se marcan; los reincidentes se congelan; y hay acuerdos legales.

## 6. La economía en una tabla
Recomendación para el piloto (`docs/ECONOMICS.md` §7; las decisiones finales son del usuario, Q19–Q29).

| Concepto | Quién lo crea o lo cobra | Cuánto |
|---|---|---|
| Moneda de gas ARPB | Solo la creación de la cadena; emisión desactivada | Gratis para el usuario; no se vende |
| USDT/USDC en la cadena | Solo el puente del banco, 1:1 contra dólares bloqueados | Respaldo 1:1 comprobable |
| Saldos cifrados (eERC) | El dueño deposita y retira 1:1 | Sin comisión |
| Pago al comercio (QR y Split Pay) | Mecanismo en código, tope fijo de **1 %** | **0 %** en el piloto |
| Venta de dólares del comercio | El comercio, dentro de la banda del banco (tasa del banco ± margen) | El comercio gana el margen, p. ej. hasta 1 % (**SUPUESTO**) |
| Puente de entrada / salida | El banco | Entrada gratis; salida con tarifa fija solo para cubrir el gas (**SUPUESTO**) |
| Colateral del comercio | El propio comercio, en su billetera | ~$100 (tope de la etapa C) |
| Liquidez inicial del banco | El banco | ~$1,000 para su mesa de cambio USD↔Bs |
| Validadores | Cada operador paga su nodo | ≈ 1,33 AVAX/mes por validador (medido, S1) |

Lectura honesta: con el tope del piloto (unos $4,000 en la cadena), el piloto **no es un negocio, es una prueba medida** con un
costo estimado de unos $200–$250 al mes (**SUPUESTO**). Su objetivo es el del usuario: "una prueba pequeña de la idea y de cómo
puede fallar o encajar en el mundo real".

## 7. Hoja de ruta (estado honesto)
| Etapa | Red | Dinero | Estado |
|---|---|---|---|
| **A** | Red local | Ninguno | **Construido y probado:** L1 privada con lista de permisos, congelamiento, lista de despliegue y emisión desactivada, 15/15 (D-008); saldos cifrados eERC de punta a punta: registro, depósito, pago privado, retiro (D-012); contrato Split Pay A con 34 pruebas y auditoría independiente (D-010); landing v0 (D-013). **Pendiente:** medir el tiempo de prueba en un teléfono de gama baja (proyectado 25–60 s en el navegador, sin medir) |
| **B** | Fuji (testnet de Avalanche) | USDC de prueba | **En preparación:** guía de despliegue escrita (D-016); ejecución, contrato del registro de ventas FX y app de prueba para MetaMask reservados (D-019, D-020, D-022) |
| **C** | Mainnet | **Real: ~$1,000 de liquidez + $100 por comercio** (una panadería, una recarga de agua) | **Planificado.** Requiere: puente construido y auditado, multifirmas, KYC con el banco, envoltura legal (Q10) |

Todavía no construido: puente (S6), multifirma de auditoría (S3), congelamiento por multifirma (S4), KYC con el banco (S5), registro
de ventas FX, RPC privado con autenticación.

## 8. Riesgos que conocemos (y no escondemos)
- **La tasa:** si la banda usa solo la tasa oficial y la brecha con el paralelo es de ~11,7 % (octubre 2026), el comercio pierde.
  Por eso el plan ancla la tasa en "BCV oficial más mediana P2P, firmada y con límites".
- **Costo frente a Pago Móvil y Binance P2P**, que los comercios consideran baratos o gratis; y un posible IGTF de 3 %.
- **Licencias:** la custodia y el cambio de USDT probablemente requieren operar bajo un licenciatario de SUNACRIP (Q10).
- **Tecnología nueva:** eERC aún no tiene despliegues de producción conocidos; el tiempo de prueba en teléfonos es el mayor riesgo.

## 9. Lo que pedimos
**A un banco** (de preferencia un banco privado mediano que ya trabaje con fintechs de stablecoins):
1. Operar los validadores y el relayer del puente, y hacer el KYC/KYB.
2. Fijar la tasa de referencia y el margen de la banda.
3. Designar firmantes para las multifirmas de auditoría y congelamiento.
4. Acompañar la revisión legal (SUNACRIP, OFAC, tributaria) antes de cualquier dinero real.
5. Probar el flujo completo en la etapa B (testnet, sin dinero real).

**A los comercios:**
1. Probar la app en la etapa B con MetaMask, sin dinero real.
2. Decirnos qué les cuesta hoy cobrar y cambiar dólares, para medir el costo por cada $100 frente a Pago Móvil y Binance P2P.
3. Si la etapa B funciona y se cumplen la auditoría y la parte legal: participar en la etapa C con hasta $100 propios, en su propia
   billetera.

---

## English summary
- **Problem:** Venezuelan micro-merchants already use USDT/USDC through channels with no records, no theft protection and public
  balances; banks want to serve them without rebuilding their core.
- **Solution:** a bank-run private Avalanche L1; KYC mandatory; real USDT/USDC locked 1:1 on C-Chain through the bank's single
  bridge; balances and amounts encrypted with eERC (self-custody); QR payments priced in bolívares, Split Pay; merchants sell
  dollars inside the bank's rate band with every sale recorded; audit and freeze by bank-led multisig, never one key; no resale.
- **Economics (pilot recommendation, decisions Q19–Q29 are the user's):** gas free to users from genesis ARPB (no minting, not
  sold); 0 % payment fee with a 1 % hard cap in code; merchants earn the FX band markup; the bank charges a cost-recovery bridge
  exit fee and runs its USD↔Bs desk with the ~$1,000 float; validators ≈ 1.33 AVAX/month each (measured). At stage C caps
  (~$4,000 on chain) the pilot is a measured cost of about $200–$250/month (ASSUMPTION), not a business.
- **Status:** stage A built and tested locally (private L1 15/15, eERC end to end, Split Pay A with 34 tests and an audit). Stage B
  (Fuji) in preparation. Stage C (real money) planned, gated by the bridge, an audit, multisigs, bank KYC and a legal wrapper. The
  bridge is not built yet; phone proof time is not measured yet.
- **Ask:** one partner bank to run validators, bridge relayer and KYC, set the rate band, name multisig signers and join the legal
  review; merchants to test stage B and share their current costs.
- **Testnet only, no real money, no yield or return promised.**
