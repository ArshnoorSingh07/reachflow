import'@testing-library/jest-dom/vitest';import{cleanup}from'@testing-library/react';import{afterEach}from'vitest';afterEach(cleanup);
// jsdom has no layout engine; focus-trap visibility is covered by manual browser QA.
Object.defineProperty(HTMLElement.prototype,'getClientRects',{value(){return[{width:100,height:30}];}});
