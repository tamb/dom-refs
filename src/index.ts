// Interface for the refWatcher return type
interface RefWatcher {
  stop: () => void;
}

/**
 * Creates a Map that maps string keys (from data-ref, id, or data-ref-array) to DOM elements or arrays of elements.
 * @param root The root element or document to search within (defaults to document.body)
 * @returns A Map with string keys and Element or Element[] values
 */
function createRefs(root: Element | Document = document.body): Map<string, Element | Element[]> {
  const refs: Map<string, Element | Element[]> = new Map<string, Element | Element[]>();

  // Function to process a single element and update the refs Map
  const processElement = (element: Element): void => {
    // Handle data-ref-array for arrays
    const refArray: string | null = element.getAttribute("data-ref-array");
    if (refArray) {
      const arrayKeys: string[] = refArray.split(",").map((key: string) => key.trim());
      arrayKeys.forEach((key: string) => {
        if (key) {
          const existingValue: Element | Element[] | undefined = refs.get(key);
          if (Array.isArray(existingValue)) {
            existingValue.push(element);
          } else if (existingValue === undefined) {
            refs.set(key, [element]);
          }
        }
      });
    }

    // Handle data-ref for single refs (takes precedence)
    const dataRef: string | null = element.getAttribute("data-ref");
    if (dataRef) {
      refs.set(dataRef, element);
      return;
    }

    // Handle id as a fallback
    const id: string = element.id;
    if (id) {
      refs.set(id, element);
    }
  };

  // Initial population of refs
  const allElements: NodeListOf<Element> = root.querySelectorAll("*");
  allElements.forEach((element: Element) => processElement(element));

  return refs;
}

/**
 * Watches the DOM for changes and updates the refs Map dynamically.
 * @param refs The Map to update with new references
 * @param root The root element or document to observe (defaults to document.body)
 * @returns An object with a stop method to disconnect the observer
 */
function refWatcher(refs: Map<string, Element | Element[]>, root: Element | Document = document.body): RefWatcher {
  // Function to process a single element and update the refs Map
  const processElement = (element: Element): void => {
    // Handle data-ref-array for arrays
    const refArray: string | null = element.getAttribute("data-ref-array");
    if (refArray) {
      const arrayKeys: string[] = refArray.split(",").map((key: string) => key.trim());
      arrayKeys.forEach((key: string) => {
        if (key) {
          const existingValue: Element | Element[] | undefined = refs.get(key);
          if (Array.isArray(existingValue)) {
            existingValue.push(element);
          } else if (existingValue === undefined) {
            refs.set(key, [element]);
          }
        }
      });
    }

    // Handle data-ref for single refs (takes precedence)
    const dataRef: string | null = element.getAttribute("data-ref");
    if (dataRef) {
      refs.set(dataRef, element);
      return;
    }

    // Handle id as a fallback
    const id: string = element.id;
    if (id) {
      refs.set(id, element);
    }
  };

  // MutationObserver callback to handle DOM changes
  const mutationCallback = (mutations: MutationRecord[]): void => {
    mutations.forEach((mutation: MutationRecord) => {
      const addedNodes: NodeList = mutation.addedNodes;
      addedNodes.forEach((node: Node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element: Element = node as Element;
          processElement(element);
          const nestedElements: NodeListOf<Element> = element.querySelectorAll("*");
          nestedElements.forEach((nestedElement: Element) => processElement(nestedElement));
        }
      });
    });
  };

  // Create and configure the MutationObserver
  const observer: MutationObserver = new MutationObserver(mutationCallback);
  const observerConfig: MutationObserverInit = {
    childList: true,
    subtree: true,
  };
  observer.observe(root, observerConfig);

  // Return the control object
  const watcher: RefWatcher = {
    stop: (): void => {
      observer.disconnect();
    },
  };

  return watcher;
}



export { createRefs, refWatcher };