/// <reference lib="dom" />

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRefs, watchRefs, IRefsObject, RefEventsEnum } from './index';

describe('DOM Refs Library', () => {
  let root: HTMLDivElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    root = document.createElement('div');
    document.body.appendChild(root);
  });

  describe('createRefs', () => {
    it('creates nested refs from data-ref attributes with dots', () => {
      const div = document.createElement('div');
      div.setAttribute('data-ref', 'header.title');
      root.appendChild(div);

      const refs = createRefs(root);
      expect((refs.header as IRefsObject).title).toBe(div);
    });

    it('creates array refs from data-ref-array attributes with dots', () => {
      const div1 = document.createElement('div');
      div1.setAttribute('data-ref-array', 'items.list, items.other');
      const div2 = document.createElement('div');
      div2.setAttribute('data-ref-array', 'items.list');
      root.appendChild(div1);
      root.appendChild(div2);

      const refs = createRefs(root);
      expect((refs.items as IRefsObject).list).toEqual([div1, div2]);
      expect((refs.items as IRefsObject).other).toEqual([div1]);
    });

    it('creates nested refs from id attributes with dots', () => {
      const div = document.createElement('div');
      div.id = 'main.section';
      root.appendChild(div);

      const refs = createRefs(root);
      expect((refs.main as IRefsObject).section).toBe(div);
    });

    it('respects custom selector', () => {
      const div1 = document.createElement('div');
      div1.setAttribute('data-ref', 'test.one');
      div1.className = 'ref-item';
      const div2 = document.createElement('div');
      div2.setAttribute('data-ref', 'test.two');
      root.appendChild(div1);
      root.appendChild(div2);

      const refs = createRefs(root, { selector: '.ref-item' });
      expect((refs.test as IRefsObject).one).toBe(div1);
      expect((refs.test as IRefsObject).two).toBeUndefined();
    });

    it('respects custom attribute names', () => {
      const div = document.createElement('div');
      div.setAttribute('custom-ref', 'header.title');
      root.appendChild(div);

      const refs = createRefs(root, { refAttr: 'custom-ref' });
      expect((refs.header as IRefsObject).title).toBe(div);
    });
  });

  describe('watchRefs', () => {
    it('adds new elements dynamically and fires event', async () => {
      const refs = createRefs(root);
      const watcher = watchRefs(refs, root);
      const addedEvents: CustomEvent[] = [];
      document.addEventListener(RefEventsEnum.ADDED, (e) =>
        addedEvents.push(e as CustomEvent),
      );

      const div = document.createElement('div');
      div.setAttribute('data-ref', 'dynamic.test');
      root.appendChild(div);

      await vi.waitFor(
        () => {
          expect((refs.dynamic as IRefsObject).test).toBe(div);
          expect(addedEvents.length).toBe(1);
          expect(addedEvents[0].detail.ref).toBe(div);
          expect(addedEvents[0].detail.key).toBe('dynamic.test');
        },
        { timeout: 100 },
      );

      watcher.stop();
    });

    it('removes elements dynamically and fires event', async () => {
      const div = document.createElement('div');
      div.setAttribute('data-ref', 'dynamic.test');
      root.appendChild(div);

      const refs = createRefs(root);
      const watcher = watchRefs(refs, root);
      const removedEvents: CustomEvent[] = [];
      document.addEventListener(RefEventsEnum.REMOVED, (e) =>
        removedEvents.push(e as CustomEvent),
      );

      root.removeChild(div);

      await vi.waitFor(
        () => {
          expect(refs.dynamic).toBeUndefined();
          expect(removedEvents.length).toBe(1);
          expect(removedEvents[0].detail.ref).toBe(div);
          expect(removedEvents[0].detail.key).toBe('dynamic.test');
        },
        { timeout: 100 },
      );

      watcher.stop();
    });

    it('respects selector in watcher', async () => {
      const refs = createRefs(root);
      const watcher = watchRefs(refs, root, { selector: '.watch-me' });
      const addedEvents: CustomEvent[] = [];
      document.addEventListener('domRefs.elementAdded', (e) =>
        addedEvents.push(e as CustomEvent),
      );

      const div1 = document.createElement('div');
      div1.setAttribute('data-ref', 'test.one');
      div1.className = 'watch-me';
      const div2 = document.createElement('div');
      div2.setAttribute('data-ref', 'test.two');
      root.appendChild(div1);
      root.appendChild(div2);

      await vi.waitFor(
        () => {
          expect((refs.test as IRefsObject).one).toBe(div1);
          expect((refs.test as IRefsObject).two).toBeUndefined();
          expect(addedEvents.length).toBe(1);
          expect(addedEvents[0].detail.key).toBe('test.one');
        },
        { timeout: 100 },
      );

      watcher.stop();
    });

    it('handles nested elements', async () => {
      const refs = createRefs(root);
      const watcher = watchRefs(refs, root);
      const addedEvents: CustomEvent[] = [];
      document.addEventListener('domRefs.elementAdded', (e) =>
        addedEvents.push(e as CustomEvent),
      );

      const parent = document.createElement('div');
      const child = document.createElement('div');
      child.setAttribute('data-ref', 'nested.child');
      parent.appendChild(child);
      root.appendChild(parent);

      await vi.waitFor(
        () => {
          expect((refs.nested as IRefsObject).child).toBe(child);
          expect(addedEvents.length).toBe(1);
          expect(addedEvents[0].detail.key).toBe('nested.child');
        },
        { timeout: 100 },
      );

      watcher.stop();
    });

    it('stops watching when stop is called', async () => {
      const refs = createRefs(root);
      const watcher = watchRefs(refs, root);
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
      const refs = createRefs(root);
      const watcher = watchRefs(refs, root, { refAttr: 'custom-ref' });
      const addedEvents: CustomEvent[] = [];
      document.addEventListener('domRefs.elementAdded', (e) =>
        addedEvents.push(e as CustomEvent),
      );

      const div = document.createElement('div');
      div.setAttribute('custom-ref', 'custom.test');
      root.appendChild(div);

      await vi.waitFor(
        () => {
          expect((refs.custom as IRefsObject).test).toBe(div);
          expect(addedEvents.length).toBe(1);
          expect(addedEvents[0].detail.key).toBe('custom.test');
        },
        { timeout: 100 },
      );

      watcher.stop();
    });
  });

  describe('Edge Cases', () => {
    it('handles duplicate data-ref values', () => {
      const div1 = document.createElement('div');
      div1.setAttribute('data-ref', 'test.value');
      const div2 = document.createElement('div');
      div2.setAttribute('data-ref', 'test.value');
      root.appendChild(div1);
      root.appendChild(div2);

      const refs = createRefs(root);
      expect((refs.test as IRefsObject).value).toBe(div2); // Last one wins
    });

    it('handles malformed data-ref-array', () => {
      const div = document.createElement('div');
      div.setAttribute('data-ref-array', 'items.list,, ,items.other');
      root.appendChild(div);

      const refs = createRefs(root);
      expect((refs.items as IRefsObject).list).toEqual([div]);
      expect((refs.items as IRefsObject).other).toEqual([div]);
    });

    it('handles empty refs object', () => {
      const refs = createRefs(root);
      expect(Object.keys(refs).length).toBe(0);
    });

    it('handles invalid selector gracefully', () => {
      const refs = createRefs(root, { selector: 'invalid::selector' });
      expect(Object.keys(refs).length).toBe(0); // No matches, no crash
    });
  });
});
