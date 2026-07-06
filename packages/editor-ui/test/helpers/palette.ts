// Shared palette-reading test helper (§12.6 presentation: category divider labels inside the
// flat flyout). Single source for every suite that asserts on visible palette categories, so the
// next flyout/label API migration edits ONE reader instead of one per test file.

/** The visible §12.4 category names — the divider labels of the flat flyout, in order. */
export function categoryNames(ws: unknown): string[] {
  const flyout = (ws as { getFlyout?(): unknown }).getFlyout?.() as {
    getContents(): Array<{ getType(): string; getElement(): { getButtonText?(): string } }>;
  } | null;
  return (flyout?.getContents() ?? [])
    .filter((i) => i.getType() === 'label')
    .map((i) => i.getElement().getButtonText?.())
    .filter((n): n is string => typeof n === 'string');
}
