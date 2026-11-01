import { useEffect, type RefObject } from "react";
export function useDialog(
  ref: RefObject<HTMLElement | null>,
  close: () => void,
  locked = false,
) {
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const elements = () =>
      Array.from(
        ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
        ) ?? [],
      ).filter((x) => x.getClientRects().length > 0);
    elements()[0]?.focus();
    function key(e: KeyboardEvent) {
      if (e.key === "Escape" && !locked) close();
      if (e.key === "Tab") {
        const all = elements(),
          first = all[0],
          last = all.at(-1);
        if (!first) {
          e.preventDefault();
          ref.current?.focus();
          return;
        }
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [ref, close, locked]);
}
