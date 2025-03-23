import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRefs, refWatcher } from './index'; // Adjust the import path

describe('createRefs and refWatcher', () => {
  let root: HTMLElement;

  // Setup DOM before each test
  beforeEach(() => {
    root = document.createElement('div');
    document.body.appendChild(root);
  });

  // Cleanup after each test
  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('createRefs', () => {
    it('creates refs from data-ref', () => {
      root.innerHTML = '<div data-ref="header">Header</div>';
      const refs = createRefs(root);
      expect(refs.get('header')).toBe(root.querySelector('[data-ref="header"]'));
    });

    it('creates refs from id', () => {
      root.innerHTML = '<span id="title">Title</span>';
      const refs = createRefs(root);
      expect(refs.get('title')).toBe(root.querySelector('#title'));
    });

    it('creates array refs from data-ref-array', () => {
      root.innerHTML = `
        <p data-ref-array="items">Item 1</p>
        <p data-ref-array="items">Item 2</p>
      `;
      const refs = createRefs(root);
      const items = refs.get('items');
      expect(Array.isArray(items)).toBe(true);
      expect(items).toHaveLength(2);
      expect(items).toContain(root.querySelectorAll('[data-ref-array="items"]')[0]);
      expect(items).toContain(root.querySelectorAll('[data-ref-array="items"]')[1]);
    });

    it('supports multiple data-ref-array keys', () => {
      root.innerHTML = '<div data-ref-array="items, highlights">Item</div>';
      const refs = createRefs(root);
      const items : Element[] | undefined = refs.get('items');
      const highlights : Element[] | undefined = refs.get('highlights');
      expect(Array.isArray(items)).toBe(true);
      expect(Array.isArray(highlights)).toBe(true);
      expect(items).toHaveLength(1);
      expect(highlights).toHaveLength(1);
      expect(items[0]).toBe(root.querySelector('[data-ref-array]'));
      expect(highlights[0]).toBe(root.querySelector('[data-ref-array]'));
    });

    it('prioritizes data-ref over data-ref-array and id', () => {
      root.innerHTML = '<div data-ref="special" data-ref-array="items" id="id">Special</div>';
      const refs = createRefs(root);
      expect(refs.get('special')).toBe(root.querySelector('[data-ref="special"]'));
      expect(refs.get('items')).toContain(root.querySelector('[data-ref="special"]'));
      expect(refs.get('id')).toBeUndefined(); // data-ref takes precedence
    });
  });

  describe('refWatcher', () => {
    it('adds new refs dynamically', async () => {
      root.innerHTML = '<div data-ref="initial">Initial</div>';
      const refs = createRefs(root);
      const watcher = refWatcher(refs, root);

      // Add a new element
      const newDiv = document.createElement('div');
      newDiv.setAttribute('data-ref', 'dynamic');
      newDiv.textContent = 'Dynamic';
      root.appendChild(newDiv);

      // Wait briefly for MutationObserver to process
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(refs.get('initial')).toBe(root.querySelector('[data-ref="initial"]'));
      expect(refs.get('dynamic')).toBe(newDiv);
      watcher.stop();
    });

    it('adds to data-ref-array dynamically', async () => {
      root.innerHTML = '<p data-ref-array="items">Item 1</p>';
      const refs = createRefs(root);
      const watcher = refWatcher(refs, root);

      // Add a new element to the array
      const newP = document.createElement('p');
      newP.setAttribute('data-ref-array', 'items');
      newP.textContent = 'Item 2';
      root.appendChild(newP);

      await new Promise(resolve => setTimeout(resolve, 10));

      const items = refs.get('items');
      expect(Array.isArray(items)).toBe(true);
      expect(items).toHaveLength(2);
      expect(items).toContain(root.querySelectorAll('[data-ref-array="items"]')[0]);
      expect(items).toContain(newP);
      watcher.stop();
    });

    it('supports nested elements', async () => {
      root.innerHTML = '<div data-ref="outer">Outer</div>';
      const refs = createRefs(root);
      const watcher = refWatcher(refs, root);

      // Add a nested structure
      const container = document.createElement('div');
      container.innerHTML = '<span data-ref="inner">Inner</span>';
      root.appendChild(container);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(refs.get('outer')).toBe(root.querySelector('[data-ref="outer"]'));
      expect(refs.get('inner')).toBe(container.querySelector('[data-ref="inner"]'));
      watcher.stop();
    });

    it('stops observing when stop is called', async () => {
      const refs = createRefs(root);
      const watcher = refWatcher(refs, root);

      // Add an element before stopping
      const firstDiv = document.createElement('div');
      firstDiv.setAttribute('data-ref', 'first');
      root.appendChild(firstDiv);

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(refs.get('first')).toBe(firstDiv);

      // Stop the watcher
      watcher.stop();

      // Add another element after stopping
      const secondDiv = document.createElement('div');
      secondDiv.setAttribute('data-ref', 'second');
      root.appendChild(secondDiv);

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(refs.get('second')).toBeUndefined(); // Should not be added
    });
  });
});