// Shared UI atoms. Status labels are the T6 vocabulary — the gate (scripts/landing-check.mjs)
// requires every element marked data-feature to carry one of these data-status values.

export const STATUS_LABEL = {
  live: 'En vivo',
  testnet: 'Red de pruebas',
  'in-development': 'En desarrollo',
  planned: 'Planeado',
};

export function Status({ value, note }) {
  const label = STATUS_LABEL[value] || value;
  return (
    <span className={`status ${value}`}>
      {label}
      {note ? ` · ${note}` : ''}
    </span>
  );
}

// A feature card: name + status badge + one honest sentence. Carries the data-status the gate checks.
export function Feature({ title, status, note, children }) {
  return (
    <article className="card" data-feature data-status={status}>
      <h3>
        <span>{title}</span>
        <Status value={status} note={note} />
      </h3>
      <p>{children}</p>
    </article>
  );
}
