/**
 * Application Entry Point
 *
 * Bootstraps the benchmark UI once the DOM is fully parsed.
 * Deferring initialisation to {@link DOMContentLoaded} guarantees that all
 * element IDs referenced inside {@link BenchUI} exist before the constructor
 * tries to query them.
 */

import { BenchUI } from "./bench-ui";

// Wait for the DOM to be ready before instantiating BenchUI, because the
// constructor immediately queries element IDs that must already exist.
document.addEventListener("DOMContentLoaded", () => {
  new BenchUI();
});
