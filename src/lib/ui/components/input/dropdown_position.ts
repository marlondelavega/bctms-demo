/**
 * Inline style that pins a popover list directly under its input (anchor-name `--{anchor}`),
 * flipping above the input when there's no room below.
 */
export const dropdownPosition = (anchor: string) =>
	[
		`position-anchor: --${anchor}`,
		'position-area: none',
		'inset: auto',
		'top: anchor(bottom)',
		'left: anchor(left)',
		'margin: 0.25rem 0 0',
		'width: anchor-size(width)',
		'position-try-fallbacks: flip-block'
	].join('; ');

/**
 * `mousedown` handler for the list's options. Pressing an option must not move focus off the
 * input: a focused option inside daisyUI's `.dropdown` matches
 * `.dropdown:focus-within > [tabindex]:first-child { pointer-events: none }`, which swallowed
 * clicks on the first option, and the input's blur fires `change`, which clears the value
 * before the click lands.
 */
export const keepInputFocus = (e: MouseEvent) => e.preventDefault();
