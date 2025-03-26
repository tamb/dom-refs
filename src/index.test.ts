/// <reference lib="dom" />

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRefs, refWatcher } from './index';

describe('Refs Library', () => {
  let root: HTMLDivElement;

  beforeEach(() => {
    // Reset DOM before each test
    document.body.innerHTML = '';
    root = document.createElement('div');
    document.body.appendChild(root);
  });

  describe('createRefs', () => {
    it('creates refs from data-ref attributes', () => {
      const div = document.createElement('div');
      div.setAttribute('data-ref', 'header.title');
      root.appendChild(div);

      const { refs } = createRefs(root);
      expect(refs.header.title).toBe(div);
    });

    it('creates array refs from data-ref-array attributes', () => {
      const div1 = document.createElement('div');
      div1.setAttribute('data-ref-array', 'items, list');
      const div2 = document.createElement('div');
      div2.setAttribute('data-ref-array', 'items');
      root.appendChild(div1);
      root.appendChild(div2);

      const { refs } = createRefs(root);
      expect(refs.items).toEqual([div1, div2]);
      expect(refs.list).toEqual([div1]);
    });

    it('creates refs from id attributes', () => {
      const div = document.createElement('div');
      div.id = 'main';
      root.appendChild(div);

      const { refs } = createRefs(root);
      expect(refs.main).toBe(div);
    });

    it('respects custom selector', () => {
      const div1 = document.createElement('div');
      div1.setAttribute('data-ref', 'test.one');
      div1.className = 'ref-item';
      const div2 = document.createElement('div');
      div2.setAttribute('data-ref', 'test.two');
      root.appendChild(div1);
      root.appendChild(div2);

      const { refs } = createRefs(root, { selector: '.ref-item' });
      expect(refs.test.one).toBe(div1);
      expect(refs.test.two).toBeUndefined();
    });

    it('respects custom attribute names', () => {
      const div = document.createElement('div');
      div.setAttribute('custom-ref', 'header.title');
      root.appendChild(div);

      const { refs } = createRefs(root, { refAttr: 'custom-ref' });
      expect(refs.header.title).toBe(div);
    });

    it('clears all refs', () => {
      const div = document.createElement('div');
      div.setAttribute('data-ref', 'header.title');
      root.appendChild(div);

      const { refs, clear } = createRefs(root);
      expect(refs.header.title).toBe(div);
      clear();
      expect(refs.header).toBeUndefined();
    });

    it('maintains reverseMap correctly', () => {
      const div = document.createElement('div');
      div.setAttribute('data-ref', 'header.title');
      div.setAttribute('data-ref-array', 'items');
      root.appendChild(div);

      const { reverseMap } = createRefs(root);
      const paths = reverseMap.get(div);
      expect(paths).toEqual(['header.title', 'items']);
    });

    it('works with generic types', () => {
      const div = document.createElement('div');
      div.setAttribute('data-ref', 'test.div');
      root.appendChild(div);

      const { refs } = createRefs<HTMLDivElement>(root);
      expect(refs.test.div).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe('refWatcher', () => {
    it('adds new elements dynamically', async () => {
      const { refs, reverseMap } = createRefs(root);
      const watcher = refWatcher(refs, root);

      const div = document.createElement('div');
      div.setAttribute('data-ref', 'dynamic.test');
      root.appendChild(div);

      await vi.waitFor(
        () => {
          expect(refs.dynamic.test).toBe(div);
          expect(reverseMap.get(div)).toEqual(['dynamic.test']);
        },
        { timeout: 100 },
      );

      watcher.stop();
    });

    it('removes elements dynamically', async () => {
      const div = document.createElement('div');
      div.setAttribute('data-ref', 'dynamic.test');
      root.appendChild(div);

      const { refs, reverseMap } = createRefs(root);
      const watcher = refWatcher(refs, root);

      root.removeChild(div);

      await vi.waitFor(
        () => {
          expect(refs.dynamic).toBeUndefined();
          expect(reverseMap.get(div)).toBeUndefined();
        },
        { timeout: 100 },
      );

      watcher.stop();
    });

    it('respects selector in watcher', async () => {
      const { refs } = createRefs(root);
      const watcher = refWatcher(refs, root, { selector: '.watch-me' });

      const div1 = document.createElement('div');
      div1.setAttribute('data-ref', 'test.one');
      div1.className = 'watch-me';
      const div2 = document.createElement('div');
      div2.setAttribute('data-ref', 'test.two');
      root.appendChild(div1);
      root.appendChild(div2);

      await vi.waitFor(
        () => {
          expect(refs.test.one).toBe(div1);
          expect(refs.test.two).toBeUndefined();
        },
        { timeout: 100 },
      );

      watcher.stop();
    });

    it('handles nested elements', async () => {
      const { refs } = createRefs(root);
      const watcher = refWatcher(refs, root);

      const parent = document.createElement('div');
      const child = document.createElement('div');
      child.setAttribute('data-ref', 'nested.child');
      parent.appendChild(child);
      root.appendChild(parent);

      await vi.waitFor(
        () => {
          expect(refs.nested.child).toBe(child);
        },
        { timeout: 100 },
      );

      watcher.stop();
    });

    it('stops watching when stop is called', async () => {
      const { refs } = createRefs(root);
      const watcher = refWatcher(refs, root);
      watcher.stop();

      const div = document.createElement('div');
      div.setAttribute('data-ref', 'after.stop');
      root.appendChild(div);

      await vi.waitFor(
        () => {
          expect(refs.after).toBeUndefined();
        },
        { timeout: 100 },
      );
    });

    it('respects custom attribute names in watcher', async () => {
      const { refs } = createRefs(root);
      const watcher = refWatcher(refs, root, { refAttr: 'custom-ref' });

      const div = document.createElement('div');
      div.setAttribute('custom-ref', 'custom.test');
      root.appendChild(div);

      await vi.waitFor(
        () => {
          expect(refs.custom.test).toBe(div);
        },
        { timeout: 100 },
      );

      watcher.stop();
    });
  });

  describe('Edge Cases', () => {
    it('handles duplicate data-ref values', () => {
      const div1 = document.createElement('div');
      div1.setAttribute('data-ref', 'test');
      const div2 = document.createElement('div');
      div2.setAttribute('data-ref', 'test');
      root.appendChild(div1);
      root.appendChild(div2);

      const { refs } = createRefs(root);
      expect(refs.test).toBe(div2); // Last one wins
    });

    it('handles malformed data-ref-array', () => {
      const div = document.createElement('div');
      div.setAttribute('data-ref-array', 'items,, ,list');
      root.appendChild(div);

      const { refs } = createRefs(root);
      expect(refs.items).toEqual([div]);
      expect(refs.list).toEqual([div]);
    });

    it('handles empty refs object', () => {
      const { refs, clear } = createRefs(root);
      expect(Object.keys(refs).length).toBe(0);
      clear(); // Should not throw
    });

    it('handles invalid selector gracefully', () => {
      const { refs } = createRefs(root, { selector: 'invalid::selector' });
      expect(Object.keys(refs).length).toBe(0); // No matches, no crash
    });
  });
});
