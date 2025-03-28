/// <reference lib="dom" />

export interface IRefsObject {
  [key: string]: Element | Element[] | IRefsObject;
}

export interface IWatchRefs {
  stop: () => void;
}

export interface IRefsOptions {
  refAttr?: string;
  idAttr?: string;
  refArrayAttr?: string;
  selector?: string;
}

export const RefEventsEnum = {
  ADDED: 'domRefs.elementAdded',
  REMOVED: 'domRefs.elementRemoved',
};

function setNestedValue(
  obj: IRefsObject,
  path: string,
  value: Element | Element[],
): void {
  const keys = path.split('.');
  let current: IRefsObject = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (
      !current[key] ||
      !(current[key] instanceof Object) ||
      Array.isArray(current[key])
    ) {
      current[key] = {};
    }
    current = current[key] as IRefsObject;
  }

  const finalKey = keys[keys.length - 1];
  current[finalKey] = value;
}

function appendNestedArray(
  obj: IRefsObject,
  path: string,
  element: Element,
): void {
  const keys = path.split('.');
  let current: IRefsObject = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (
      !current[key] ||
      !(current[key] instanceof Object) ||
      Array.isArray(current[key])
    ) {
      current[key] = {};
    }
    current = current[key] as IRefsObject;
  }

  const finalKey = keys[keys.length - 1];
  if (!Array.isArray(current[finalKey])) {
    current[finalKey] = [];
  }
  (current[finalKey] as Element[]).push(element);
}

function createRefs(
  root: Element | Document = document.body,
  options: IRefsOptions = {},
): IRefsObject {
  const {
    refAttr = 'data-ref',
    refArrayAttr = 'data-ref-array',
    idAttr = 'id',
    selector,
  } = options;
  const refs: IRefsObject = {};

  const processElement = (element: Element): void => {
    const refArray = element.getAttribute(refArrayAttr);
    if (refArray) {
      const arrayKeys = refArray
        .split(',')
        .map((key) => key.trim())
        .filter(Boolean);
      arrayKeys.forEach((key) => appendNestedArray(refs, key, element));
    }

    const dataRef = element.getAttribute(refAttr);
    if (dataRef) {
      setNestedValue(refs, dataRef, element);
      return;
    }

    const id = (element as any)[idAttr];
    if (id) {
      setNestedValue(refs, id, element);
    }
  };

  const defaultSelector = `[${refAttr}],[${refArrayAttr}],[${idAttr}]`;
  const allElements = selector
    ? root.querySelectorAll(selector)
    : root.querySelectorAll(defaultSelector);
  allElements.forEach((element) => processElement(element));

  return Object.assign(refs);
}

function watchRefs(
  refs: IRefsObject,
  root: Element | Document = document.body,
  options: IRefsOptions = {},
): IWatchRefs {
  const {
    refAttr = 'data-ref',
    refArrayAttr = 'data-ref-array',
    idAttr = 'id',
    selector,
  } = options;
  const reverseMap: WeakMap<Element, string[]> = new WeakMap<
    Element,
    string[]
  >();

  const initializeReverseMap = (obj: IRefsObject, path: string = '') => {
    for (const key in obj) {
      if (key === 'clear') continue; // Skip the clear method
      const fullPath = path ? `${path}.${key}` : key;
      const value = obj[key];
      if (value instanceof Element) {
        const paths = reverseMap.get(value) || [];
        if (!paths.includes(fullPath)) {
          paths.push(fullPath);
          reverseMap.set(value, paths);
        }
      } else if (Array.isArray(value)) {
        value.forEach((element) => {
          const paths = reverseMap.get(element) || [];
          if (!paths.includes(fullPath)) {
            paths.push(fullPath);
            reverseMap.set(element, paths);
          }
        });
      } else if (value && typeof value === 'object') {
        initializeReverseMap(value as IRefsObject, fullPath);
      }
    }
  };
  initializeReverseMap(refs);

  const processElement = (element: Element): void => {
    const refArray = element.getAttribute(refArrayAttr);
    if (refArray) {
      const arrayKeys = refArray
        .split(',')
        .map((key) => key.trim())
        .filter(Boolean);
      arrayKeys.forEach((key) => {
        appendNestedArray(refs, key, element);
        const paths = reverseMap.get(element) || [];
        if (!paths.includes(key)) {
          paths.push(key);
          reverseMap.set(element, paths);
          document.dispatchEvent(
            new CustomEvent(RefEventsEnum.ADDED, {
              detail: { ref: element, key },
            }),
          );
        }
      });
    }

    const dataRef = element.getAttribute(refAttr);
    if (dataRef) {
      setNestedValue(refs, dataRef, element);
      const paths = reverseMap.get(element) || [];
      if (!paths.includes(dataRef)) {
        paths.push(dataRef);
        reverseMap.set(element, paths);
        document.dispatchEvent(
          new CustomEvent(RefEventsEnum.ADDED, {
            detail: { ref: element, key: dataRef },
          }),
        );
      }
      return;
    }

    const id = (element as any)[idAttr];
    if (id) {
      setNestedValue(refs, id, element);
      const paths = reverseMap.get(element) || [];
      if (!paths.includes(id)) {
        paths.push(id);
        reverseMap.set(element, paths);
        document.dispatchEvent(
          new CustomEvent(RefEventsEnum.ADDED, {
            detail: { ref: element, key: id },
          }),
        );
      }
    }
  };

  const removeElement = (element: Element): void => {
    const paths = reverseMap.get(element);
    if (!paths || paths.length === 0) return;

    paths.forEach((path: string) => {
      const keys = path.split('.');
      let current: IRefsObject = refs;

      for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (!current[key]) return;
        current = current[key] as IRefsObject;
      }

      const finalKey = keys[keys.length - 1];
      const value = current[finalKey];

      if (value === element) {
        delete current[finalKey];
        document.dispatchEvent(
          new CustomEvent(RefEventsEnum.REMOVED, {
            detail: { ref: element, key: path },
          }),
        );
      } else if (Array.isArray(value)) {
        const index = value.indexOf(element);
        if (index !== -1) {
          value.splice(index, 1);
          document.dispatchEvent(
            new CustomEvent(RefEventsEnum.REMOVED, {
              detail: { ref: element, key: path },
            }),
          );
          if (value.length === 0) {
            delete current[finalKey];
          }
        }
      }
    });

    const remainingPaths = paths.some((path: string) => {
      const keys = path.split('.');
      let current: IRefsObject = refs;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) return false;
        current = current[keys[i]] as IRefsObject;
      }
      const finalValue = current[keys[keys.length - 1]];
      return (
        finalValue === element ||
        (Array.isArray(finalValue) && finalValue.includes(element))
      );
    });

    if (!remainingPaths) {
      reverseMap.delete(element);
    }
  };

  const defaultSelector = `[${refAttr}],[${refArrayAttr}],[${idAttr}]`;
  const mutationCallback = (mutations: MutationRecord[]): void => {
    mutations.forEach((mutation: MutationRecord) => {
      const addedNodes = mutation.addedNodes;
      addedNodes.forEach((node: Node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as Element;
          if (!selector || element.matches(selector)) {
            processElement(element);
          }
          const nestedElements = selector
            ? element.querySelectorAll(selector)
            : element.querySelectorAll(defaultSelector);
          nestedElements.forEach((nestedElement) =>
            processElement(nestedElement),
          );
        }
      });

      const removedNodes = mutation.removedNodes;
      removedNodes.forEach((node: Node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as Element;
          removeElement(element);
          const nestedElements = selector
            ? element.querySelectorAll(selector)
            : element.querySelectorAll(defaultSelector);
          nestedElements.forEach((nestedElement) =>
            removeElement(nestedElement),
          );
        }
      });
    });
  };

  const observer = new MutationObserver(mutationCallback);
  observer.observe(root, { childList: true, subtree: true });

  return { stop: () => observer.disconnect() };
}

export { createRefs, watchRefs };
