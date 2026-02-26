export const HotkeysPanel = (): JSX.Element => {
  return (
    <section className="panel" data-testid="panel-hotkeys">
      <h3>Hotkeys</h3>
      <ul className="list">
        <li>1: toggle left dock</li>
        <li>2: toggle right dock</li>
        <li>3: toggle bottom dock</li>
      </ul>
    </section>
  );
};
