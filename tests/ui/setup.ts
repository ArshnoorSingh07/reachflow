import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
afterEach(cleanup);
// jsdom has no layout engine; focus-trap visibility is covered by manual browser QA.
Object.defineProperty(HTMLElement.prototype, "getClientRects", {
  value() {
    return [{ width: 100, height: 30 }];
  },
});

// ProseMirror requests Range geometry; jsdom has no layout implementation.
Object.defineProperty(Range.prototype, "getClientRects", {
  value() {
    return [
      { width: 100, height: 20, top: 0, bottom: 20, left: 0, right: 100 },
    ];
  },
});
Object.defineProperty(Range.prototype, "getBoundingClientRect", {
  value() {
    return { width: 100, height: 20, top: 0, bottom: 20, left: 0, right: 100 };
  },
});
if (!document.elementFromPoint) document.elementFromPoint = () => document.body;

window.scrollBy = () => {};
