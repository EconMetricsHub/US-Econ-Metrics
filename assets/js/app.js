// ── INIT ─────────────────────────────────────────────────────────
initTerminalUI();
initCommandCenterUI();
buildSidebar();
const _restored = applyStateFromURL();   // mutate state from #s= hash if present
sharedStateRestored = _restored;
buildContent();                          // build sliders from current vals
runBootSequence();                       // terminal-style startup overlay
loadEconomicCalendar();                  // preload static release snapshot
syncControlsToState();                   // horizon / Taylor / country / event UI
buildHistoricalGrid();
render();
committed = snapshot();                   // baseline for undo
updateUndoRedoButtons();
wireKeyboard();
wireMetricTooltips();
if (_restored) toast('Scenario restored from shared link');

// Re-apply when the user pastes a new shared hash into the same tab
window.addEventListener('beforeunload', () => {
  try { localStorage.setItem('macroscope_overview_reference', JSON.stringify(overviewSnapshot(compute()))); } catch (_) {}
});

window.addEventListener('hashchange', () => {
  if (applyStateFromURL()) {
    buildContent();
    const btn = Array.from(document.querySelectorAll('.nav-item'))
      .find(b => b.getAttribute('onclick') && b.getAttribute('onclick').includes("'" + currentSection + "'"));
    showSection(currentSection, btn || null);
    syncControlsToState();
    render();
    committed = snapshot(); undoStack = []; redoStack = []; updateUndoRedoButtons();
  }
});
