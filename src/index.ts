/// <reference lib="dom" />

// Interface for nested refs object
interface RefsObject {
  [key: string]: Element | Element[] | RefsObject;
}

// Interface for refWatcher return type
interface RefWatcher {
  stop: () => void;
}

/**
 * Sets a value in a nested object using dot notation and updates the reverse map.
 * @param obj The refs object
 * @param reverseMap The WeakMap tracking element paths
 * @param path The dot-separated path (e.g., "my.item")
 * @param value The value to set (Element or Element[])
 */
function setNestedValue(
  obj: RefsObject,
  reverseMap: WeakMap<Element, string[]>,
  path: string,
  value: Element | Element[]
): void {
  const keys: string[] = path.split(".");
  let current: RefsObject = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    const key: string = keys[i];
    if (!current[key] || !(current[key] instanceof Object) || Array.isArray(current[key])) {
      current[key] = {};
    }
    current = current[key] as RefsObject;
  }

  const finalKey: string = keys[keys.length - 1];
  current[finalKey] = value;

  // Update reverse map for single Element
  if (value instanceof Element) {
    const paths: string[] = reverseMap.get(value) || [];
    if (!paths.includes(path)) {
      paths.push(path);
      reverseMap.set(value, paths);
    }
  }
}

/**
 * Appends an element to an array in a nested object and updates the reverse map.
 * @param obj The refs object
 * @param reverseMap The WeakMap tracking element paths
 * @param path The dot-separated path (e.g., "items.list")
 * @param element The element to append
 */
function appendNestedArray(
  obj: RefsObject,
  reverseMap: WeakMap<Element, string[]>,
  path: string,
  element: Element
): void {
  const keys: string[] = path.split(".");
  let current: RefsObject = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    const key: string = keys[i];
    if (!current[key] || !(current[key] instanceof Object) || Array.isArray(current[key])) {
      current[key] = {};
    }
    current = current[key] as RefsObject;
  }

  const finalKey: string = keys[keys.length - 1];
  if (!Array.isArray(current[finalKey])) {
    current[finalKey] = [];
  }
  (current[finalKey] as Element[]).push(element);

  // Update reverse map
  const paths: string[] = reverseMap.get(element) || [];
  if (!paths.includes(path)) {
    paths.push(path);
    reverseMap.set(element, paths);
  }
}

/**
 * Removes an element from the refs object using its paths from the reverse map.
 * @param obj The refs object
 * @param reverseMap The WeakMap tracking element paths
 * @param element The element to remove
 */
function removeElement(
  obj: RefsObject,
  reverseMap: WeakMap<Element, string[]>,
  element: Element
): void {
  const paths: string[] | undefined = reverseMap.get(element);
  if (!paths) return;

  paths.forEach((path: string) => {
    const keys: string[] = path.split(".");
    let current: RefsObject = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key: string = keys[i];
      if (!current[key]) return;
      current = current[key] as RefsObject;
    }

    const finalKey: string = keys[keys.length - 1];
    const value: Element | Element[] | RefsObject | undefined = current[finalKey];

    if (value === element) {
      delete current[finalKey];
    } else if (Array.isArray(value)) {
      const index: number = value.indexOf(element);
      if (index !== -1) {
        value.splice(index, 1);
        if (value.length === 0) {
          delete current[finalKey];
        }
      }
    }
  });

  // Clean up reverse map
  reverseMap.delete(element);
}

/**
 * Creates a nested object of DOM references with a reverse lookup map.
 * @param root The root element or document to search (defaults to document.body)
 * @returns A nested RefsObject
 */
function createRefs(root: Element | Document = document.body): RefsObject {
  const refs: RefsObject = {};
  const reverseMap: WeakMap<Element, string[]> = new WeakMap<Element, string[]>();

  const processElement = (element: Element): void => {
    const refArray: string | null = element.getAttribute("data-ref-array");
    if (refArray) {
      const arrayKeys: string[] = refArray.split(",").map((key: string) => key.trim());
      arrayKeys.forEach((key: string) => {
        if (key) {
          appendNestedArray(refs, reverseMap, key, element);
        }
      });
    }

    const dataRef: string | null = element.getAttribute("data-ref");
    if (dataRef) {
      setNestedValue(refs, reverseMap, dataRef, element);
      return;
    }

    const id: string = element.id;
    if (id) {
      setNestedValue(refs, reverseMap, id, element);
    }
  };

  const allElements: NodeListOf<Element> = root.querySelectorAll("*");
  allElements.forEach((element: Element) => processElement(element));

  // Attach reverseMap to refs for refWatcher to use
  (refs as any).__reverseMap = reverseMap;

  return refs;
}

/**
 * Watches the DOM and updates the refs object dynamically, including removals.
 * @param refs The RefsObject to update (with attached reverseMap)
 * @param root The root element or document to observe (defaults to document.body)
 * @returns A RefWatcher with a stop method
 */
function refWatcher(refs: RefsObject, root: Element | Document = document.body): RefWatcher {
  const reverseMap: WeakMap<Element, string[]> = (refs as any).__reverseMap;

  const processElement = (element: Element): void => {
    const refArray: string | null = element.getAttribute("data-ref-array");
    if (refArray) {
      const arrayKeys: string[] = refArray.split(",").map((key: string) => key.trim());
      arrayKeys.forEach((key: string) => {
        if (key) {
          appendNestedArray(refs, reverseMap, key, element);
        }
      });
    }

    const dataRef: string | null = element.getAttribute("data-ref");
    if (dataRef) {
      setNestedValue(refs, reverseMap, dataRef, element);
      return;
    }

    const id: string = element.id;
    if (id) {
      setNestedValue(refs, reverseMap, id, element);
    }
  };

  const mutationCallback = (mutations: MutationRecord[]): void => {
    mutations.forEach((mutation: MutationRecord) => {
      // Handle added nodes
      const addedNodes: NodeList = mutation.addedNodes;
      addedNodes.forEach((node: Node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element: Element = node as Element;
          processElement(element);
          const nestedElements: NodeListOf<Element> = element.querySelectorAll("*");
          nestedElements.forEach((nestedElement: Element) => processElement(nestedElement));
        }
      });

      // Handle removed nodes
      const removedNodes: NodeList = mutation.removedNodes;
      removedNodes.forEach((node: Node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element: Element = node as Element;
          removeElement(refs, reverseMap, element);
          const nestedElements: NodeListOf<Element> = element.querySelectorAll("*");
          nestedElements.forEach((nestedElement: Element) =>
            removeElement(refs, reverseMap, nestedElement)
          );
        }
      });
    });
  };

  const observer: MutationObserver = new MutationObserver(mutationCallback);
  const observerConfig: MutationObserverInit = {
    childList: true,
    subtree: true,
  };
  observer.observe(root, observerConfig);

  return {
    stop: (): void => observer.disconnect(),
  };
}

export { createRefs, refWatcher };

// Example usage
document.addEventListener("DOMContentLoaded", (): void => {
  document.body.innerHTML = `
    <div data-ref="my.item">My Item</div>
    <span data-ref-array="items.list">List Item 1</span>
    <span id="title">Title</span>
  `;

  const refs: RefsObject = createRefs(document.body);
  const watcher: RefWatcher = refWatcher(refs);

  console.log(refs.my.item);      // <div>
  console.log(refs.items.list);   // [<span>]
  console.log(refs.title);        // <span>

  // Add and remove elements
  const newItem: HTMLSpanElement = document.createElement("span");
  newItem.setAttribute("data-ref-array", "items.list");
  newItem.textContent = "List Item 2";
  document.body.appendChild(newItem);

  const newSingle: HTMLDivElement = document.createElement("div");
  newSingle.setAttribute("data-ref", "my.single");
  newSingle.textContent = "Single Item";
  document.body.appendChild(newSingle);

  setTimeout((): void => {
    console.log(refs.items.list);   // [<span>, <span>]
    console.log(refs.my.single);    // <div>
    newItem.remove();               // Remove array item
    newSingle.remove();             // Remove single ref
    setTimeout((): void => {
      console.log(refs.items.list); // [<span>]
      console.log(refs.my.single);  // undefined
      watcher.stop();
    }, 100);
  }, 100);
});