const navItems = ['Dashboard', 'Groups', 'Import Statement'];

export const Sidebar = (): JSX.Element => {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <h2>BudgetShare</h2>
        <p>Household budgeting</p>
      </div>

      <nav>
        <ul className="sidebar-nav">
          {navItems.map((item, index) => (
            <li key={item}>
              <button
                className={`sidebar-nav-item ${index === 0 ? 'is-active' : ''}`}
                type="button"
                aria-current={index === 0 ? 'page' : undefined}
              >
                {item}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
};
