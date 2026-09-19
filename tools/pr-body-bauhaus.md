Visual-only redesign of NEON CELL ARENA following a Bauhaus direction: primary colors (red/blue/yellow) on light gray, clear geometry, grid composition, bold typography, minimal decoration.

- Main menu: logo block, prominent PLAY, EXIT, geometric background, clear selected/hover/focus states
- Mode selection: Play with Bots (with explanation) / Online Play (disabled, SOON tag) / Back
- HUD: geometric chips, readable labels, entrance animation, scales on small screens
- Tutorial card: bottom-right, key/action icons, minimal text, smooth entrance, close button, auto-dismiss after 12s, adapts to mouse vs touch input
- Smooth screen transitions, full button state set (default/hover/pressed/selected/disabled), selection and game-start feedback

Core mechanics, game logic and structure are unchanged: gameplay functions in game.js are untouched, only colors and the UI shell were added. Verified in-browser: menu -> mode select -> gameplay -> tutorial (show/close/auto-hide) -> back/exit navigation.
