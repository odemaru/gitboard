import { Branch, Grid, TaskCircle, Search, Tune } from './Icons.jsx';

const ITEMS = [
  { key: 'repos', label: 'Обзор', href: '#/', Icon: Grid },
  { key: 'today', label: 'Сегодня', href: '#/today', Icon: TaskCircle },
  { key: 'search', label: 'Поиск', href: '#/search', Icon: Search },
  { key: 'settings', label: 'Настройки', href: '#/settings', Icon: Tune },
];

export default function NavRail({ active, openTasks }) {
  return (
    <nav className="rail">
      <a className="rail-logo" href="#/" title="Gitboard">
        <Branch size={22} color="#fff" />
      </a>
      <div className="rail-items">
        {ITEMS.map(({ key, label, href, Icon }) => (
          <a key={key} className={`rail-item${active === key ? ' active' : ''}`} href={href}>
            <span className="rail-pill" style={{ position: 'relative' }}>
              <Icon size={22} color={active === key ? '#1D192B' : '#49454F'} />
              {key === 'today' && openTasks > 0 && (
                <span
                  className="badge"
                  style={{ position: 'absolute', top: -4, right: 4, fontSize: 10, padding: '0 5px' }}
                >
                  {openTasks}
                </span>
              )}
            </span>
            <span className="rail-label">{label}</span>
          </a>
        ))}
      </div>
    </nav>
  );
}
