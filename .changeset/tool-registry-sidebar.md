---
'@repo/web': patch
---

The app shell now has a tools sidebar. It expands to 240px with labels or collapses to a 56px icon rail with tooltips, and remembers your choice in this browser, restored before the page first paints. The current tool is marked, and moving to another page puts keyboard focus at the start of its content. A "Skip to main content" link and proper header, navigation and main landmarks help keyboard and screen-reader use. Content now uses the full window width instead of stopping at 1024px. At 400% zoom the sidebar stays a rail, the header wraps, and your email address is no longer hidden.
