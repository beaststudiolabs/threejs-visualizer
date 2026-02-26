import type { ReactNode } from "react";

type DockLayoutProps = {
  left: ReactNode;
  right: ReactNode;
  bottom: ReactNode;
  center: ReactNode;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  bottomCollapsed: boolean;
  onToggleLeft: () => void;
  onToggleRight: () => void;
  onToggleBottom: () => void;
};

export const DockLayout = ({
  left,
  right,
  bottom,
  center,
  leftCollapsed,
  rightCollapsed,
  bottomCollapsed,
  onToggleLeft,
  onToggleRight,
  onToggleBottom
}: DockLayoutProps): JSX.Element => {
  return (
    <div className="dock-root">
      <aside className={`dock dock-left ${leftCollapsed ? "collapsed" : ""}`} data-testid="dock-left">
        <button className="dock-toggle" onClick={onToggleLeft} type="button" data-testid="toggle-left">
          {leftCollapsed ? "Open Left" : "Close Left"}
        </button>
        {!leftCollapsed && <div className="dock-content">{left}</div>}
      </aside>

      <main className="dock-center" data-testid="canvas-shell">
        {center}
      </main>

      <aside className={`dock dock-right ${rightCollapsed ? "collapsed" : ""}`} data-testid="dock-right">
        <button className="dock-toggle" onClick={onToggleRight} type="button" data-testid="toggle-right">
          {rightCollapsed ? "Open Right" : "Close Right"}
        </button>
        {!rightCollapsed && <div className="dock-content">{right}</div>}
      </aside>

      <section className={`dock dock-bottom ${bottomCollapsed ? "collapsed" : ""}`} data-testid="dock-bottom">
        <button className="dock-toggle" onClick={onToggleBottom} type="button" data-testid="toggle-bottom">
          {bottomCollapsed ? "Open Bottom" : "Close Bottom"}
        </button>
        {!bottomCollapsed && <div className="dock-content">{bottom}</div>}
      </section>
    </div>
  );
};
