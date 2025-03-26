/// <reference lib="dom" />

interface RefsObject<T extends Element = Element> {
  [key: string]: T | T[] | RefsObject<T>;
}

interface RefsHandle<T extends Element = Element> {
  refs: RefsObject<T>;
  reverseMap: WeakMap<T, string[]>;
}

interface RefWatcher {
  stop: () => void;
}

interface RefsOptions {
  refAttr?: string;
  refArrayAttr?: string;
  idAttr?: string;
  selector?: string;
}

function setNestedValue<T extends Element>(
  obj: RefsObject<T>,
  reverseMap: WeakMap<T, string[]>,
  path: string,
  value: T | T[]
): void {
  const keys: string[] = path.split(".");
  let current: RefsObject<T> = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    const key: string = keys[i];
    if (!current[key] || !(current[key] instanceof Object) || Array.isArray(current[key])) {
      current[key] = {};
    }
    current = current[key] as RefsObject<T>;
  }

  const finalKey: string = keys[keys.length - 1];
  current[finalKey] = value;

  if (value instanceof Element) {
    const paths: string[] = reverseMap.get(value as T) || [];
    if (!paths.includes(path)) {
      paths.push(path);
      reverseMap.set(value as T, paths);
    }
  }
}

function appendNestedArray<T extends Element>(
  obj: RefsObject<T>,
  reverseMap: WeakMap<T, string[]>,
  path: string,
  element: T
): void {
  const keys: string[] = path.split(".");
  let current: RefsObject<T> = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    const key: string = keys[i];
    if (!current[key] || !(current[key] instanceof Object) || Array.isArray(current[key])) {
      current[key] = {};
    }
    current = current[key] as RefsObject<T>;
  }

  const finalKey: string = keys[keys.length - 1];
  if (!Array.isArray(current[finalKey])) {
    current[finalKey] = [];
  }
  (current[finalKey] as T[]).push(element);

  const paths: string[] = reverseMap.get(element) || [];
  if (!paths.includes(path)) {
    paths.push(path);
    reverseMap.set(element, paths);
  }
}

function removeElement<T extends Element>(
  obj: RefsObject<T>,
  reverseMap: WeakMap<T, string[]>,
  element: T
): void {
  const paths: string[] | undefined = reverseMap.get(element);
  if (!paths || paths.length === 0) return;

  let allPathsProcessed = true;

  paths.forEach((path: string) => {
    const keys: string[] = path.split(".");
    let current: RefsObject<T> = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key: string = keys[i];
      if (!current[key]) {
        allPathsProcessed = false;
        return;
      }
      current = current[key] as RefsObject<T>;
    }

    const finalKey: string = keys[keys.length - 1];
    const value: T | T[] | RefsObject<T> | undefined = current[finalKey];

    if (value === element) {
      delete current[finalKey];
    } else if (Array.isArray(value)) {
      const index: number = value.indexOf(element);
      if (index !== -1) {
        value.splice(index, 1);
        if (value.length === 0) {
          delete current[finalKey];
        }
      } else {
        allPathsProcessed = false;
      }
    } else {
      allPathsProcessed = false;
    }
  });

  if (allPathsProcessed) {
    const remainingPaths = paths.some((path: string) => {
      const keys: string[] = path.split(".");
      let current: RefsObject<T> = obj;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) return false;
        current = current[keys[i]] as RefsObject<T>;
      }
      const finalValue = current[keys[keys.length - 1]];
      return finalValue === element || (Array.isArray(finalValue) && finalValue.includes(element));
    });

    if (!remainingPaths) {
      reverseMap.delete(element);
    }
  }
}

/**
 * Creates a nested object of DOM references with a reverse lookup map.
 * @param root The root element or document to search (defaults to document.body)
 * @param selector Optional CSS selector to filter elements (e.g., ".my-refs")
 * @param options Configuration for attribute names
 * @returns A handle containing refs, reverseMap, and a clear method
 * @example
 * ```html
 * <div data-ref="header.title">Title</div>
 * <div data-ref-array="items, list">Item</div>
 * ```
 * ```typescript
 * const { refs, clear } = createRefs();
 * console.log(refs.header.title); // <div> element
 * console.log(refs.items); // [<div>] array
 * clear(); // Removes all references
 * ```
 */
function createRefs<T extends Element = Element>(
  root: Element | Document = document.body,
  options: RefsOptions = {}
): RefsHandle<T> & { clear: () => void } {
  const { refAttr = "data-ref", refArrayAttr = "data-ref-array", idAttr = "id" } = options;
  const refs: RefsObject<T> = {};
  const reverseMap: WeakMap<T, string[]> = new WeakMap<T, string[]>();

  const processElement = (element: Element): void => {
    const refArray: string | null = element.getAttribute(refArrayAttr);
    if (refArray) {
      const arrayKeys: string[] = refArray.split(",").map((key: string) => key.trim());
      arrayKeys.forEach((key: string) => {
        if (key) {
          appendNestedArray(refs, reverseMap, key, element as T);
        }
      });
    }

    const dataRef: string | null = element.getAttribute(refAttr);
    if (dataRef) {
      setNestedValue(refs, reverseMap, dataRef, element as T);
      return;
    }

    const id: string = (element as any)[idAttr];
    if (id) {
      setNestedValue(refs, reverseMap, id, element as T);
    }
  };

  const clear = (): void => {
    for (const key in refs) {
      delete refs[key];
    }
  };

  const defaultSelector = `[${refAttr}],[${refArrayAttr}],[${idAttr}]`;
  const allElements: NodeListOf<Element> = options.selector
    ? root.querySelectorAll(options.selector)
    : root.querySelectorAll(defaultSelector);
  allElements.forEach((element: Element) => processElement(element));

  return { refs, reverseMap, clear };
}

/**
 * Watches the DOM and updates the refs object dynamically, including removals.
 * @param refsHandle The handle returned by createRefs
 * @param root The root element or document to observe (defaults to document.body)
 * @param selector Optional CSS selector to filter elements
 * @param options Configuration for attribute names
 * @returns A RefWatcher with a stop method
 * @example
 * ```typescript
 * const refsHandle = createRefs();
 * const watcher = refWatcher(refsHandle);
 * // DOM changes are now tracked
 * watcher.stop(); // Stops observing
 * ```
 */
function refWatcher<T extends Element>(
  refsHandle: RefsHandle<T>,
  root: Element | Document = document.body,
  selector?: string,
  options: RefsOptions = {}
): RefWatcher {
  const { refAttr = "data-ref", refArrayAttr = "data-ref-array", idAttr = "id" } = options;
  const { refs, reverseMap } = refsHandle;

  const processElement = (element: Element): void => {
    const refArray: string | null = element.getAttribute(refArrayAttr);
    if (refArray) {
      const arrayKeys: string[] = refArray.split(",").map((key: string) => key.trim());
      arrayKeys.forEach((key: string) => {
        if (key) {
          appendNestedArray(refs, reverseMap, key, element as T);
        }
      });
    }

    const dataRef: string | null = element.getAttribute(refAttr);
    if (dataRef) {
      setNestedValue(refs, reverseMap, dataRef, element as T);
      return;
    }

    const id: string = (element as any)[idAttr];
    if (id) {
      setNestedValue(refs, reverseMap, id, element as T);
    }
  };

  const defaultSelector = `[${refAttr}],[${refArrayAttr}],[${idAttr}]`;
  const mutationCallback = (mutations: MutationRecord[]): void => {
    mutations.forEach((mutation: MutationRecord) => {
      const addedNodes: NodeList = mutation.addedNodes;
      addedNodes.forEach((node: Node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element: Element = node as Element;
          if (!selector || element.matches(selector)) {
            processElement(element);
          }
          const nestedElements: NodeListOf<Element> = selector
            ? element.querySelectorAll(selector)
            : element.querySelectorAll(defaultSelector);
          nestedElements.forEach((nestedElement: Element) => processElement(nestedElement));
        }
      });

      const removedNodes: NodeList = mutation.removedNodes;
      removedNodes.forEach((node: Node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element: Element = node as Element;
          removeElement(refs, reverseMap, element as T);
          const nestedElements: NodeListOf<Element> = selector
            ? element.querySelectorAll(selector)
            : element.querySelectorAll(defaultSelector);
          nestedElements.forEach((nestedElement: Element) =>
            removeElement(refs, reverseMap, nestedElement as T)
          );
        }
      });
    });
  };

  const observer: MutationObserver = new MutationObserver(mutationCallback);
  const observerConfig: MutationObserverInit = { childList: true, subtree: true };
  observer.observe(root, observerConfig);

  return { stop: (): void => observer.disconnect() };
}

export { createRefs, refWatcher };