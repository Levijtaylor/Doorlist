import type { Stats } from '@/lib/events';

/** Going / maybe / can't go counts, with a proportional bar. */
export default function Tracker({ stats, capacity, compact = false, allowMaybe = true }: { stats: Stats; capacity?: number | null; compact?: boolean; allowMaybe?: boolean }) {
  const total = stats.going + stats.maybe + stats.declined;
  const pct = (n: number) => (total ? `${(n / total) * 100}%` : '0%');
  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className={`tracker${compact ? ' compact' : ''}`}>
        <div className="stat going">
          <b>{stats.going}</b>
          <span>Going</span>
        </div>
        {(allowMaybe || stats.maybe > 0) && (
          <div className="stat maybe">
            <b>{stats.maybe}</b>
            <span>Maybe</span>
          </div>
        )}
        <div className="stat declined">
          <b>{stats.declined}</b>
          <span>Can’t go</span>
        </div>
        {!compact && stats.invited > 0 && (
          <div className="stat">
            <b>{stats.awaiting}</b>
            <span>No reply yet</span>
          </div>
        )}
      </div>
      {total > 0 && (
        <div className="bar" aria-hidden="true">
          <i style={{ width: pct(stats.going), background: 'var(--going)' }} />
          <i style={{ width: pct(stats.maybe), background: 'var(--maybe)' }} />
          <i style={{ width: pct(stats.declined), background: 'var(--declined)' }} />
        </div>
      )}
      <p className="muted small">
        {stats.headcount} {stats.headcount === 1 ? 'person' : 'people'} coming, counting extra guests
        {capacity ? ` · ${Math.max(0, capacity - stats.headcount)} of ${capacity} spots left` : ''}
      </p>
    </div>
  );
}
