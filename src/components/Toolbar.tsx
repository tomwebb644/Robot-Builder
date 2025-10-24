import { Plus, Save, Play, Pause, Link2 } from 'lucide-react';

const TOOLBAR_ACTIONS = [
  { icon: Plus, label: 'Add Primitive', action: 'add-primitive' },
  { icon: Link2, label: 'Connect Links', action: 'connect-links' },
  { icon: Play, label: 'Simulate', action: 'simulate' },
  { icon: Pause, label: 'Pause', action: 'pause' },
  { icon: Save, label: 'Save', action: 'save' }
];

export function Toolbar() {
  return (
    <header className="toolbar">
      <div className="toolbar-title">Robot Builder Studio</div>
      <nav className="toolbar-actions" aria-label="Primary actions">
        {TOOLBAR_ACTIONS.map(({ icon: Icon, label }) => (
          <button key={label} className="toolbar-button" type="button" title={label} aria-label={label}>
            <Icon size={16} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </header>
  );
}
