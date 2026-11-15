// Admin CLI for the TEST-ONLY onboarding service.  node backend/onboarding/admin.mjs list | approve <address> [more…]
import { approve, normAddress, readStore, roleOf } from './lib.mjs';

const [cmd] = process.argv.slice(2);
if (cmd === 'list') {
  const s = readStore();
  const rows = Object.entries(s);
  if (!rows.length) console.log('(no requests)');
  for (const [addr, r] of rows) {
    let role = '?';
    try { role = (await roleOf(addr)).roleName; } catch {}
    console.log(`${addr}  ${r.status.padEnd(8)}  role=${role}  requested=${r.requestedAt}${r.approvedAt ? '  approved=' + r.approvedAt : ''}`);
  }
} else if (cmd === 'approve') {
  const addrs = process.argv.slice(3).map(normAddress);
  if (!addrs.length || addrs.includes(null)) { console.error('usage: admin.mjs approve <0xaddress> [more…]'); process.exit(2); }
  for (const address of addrs) {
    try {
      const steps = await approve(address);
      console.log(`approved ${address}: ${steps.join(', ') || 'already done'}`);
    } catch (e) {
      console.error(`approve failed ${address}: ${String(e?.shortMessage || e?.message || e).split('\n')[0].slice(0, 200)}`);
      process.exitCode = 1;
    }
  }
} else {
  console.error('usage: node backend/onboarding/admin.mjs list | approve <address>');
  process.exit(2);
}
