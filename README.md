**dom-refs**

***

# dom-refs

## Functions

### createRefs()

> **createRefs**\<`T`\>(`root`, `options`): `RefsHandle`\<`T`\> & `object`

Defined in: [index.ts:161](https://github.com/tamb/dom-refs/blob/05845d8502d3fa248dccd44462b5b6f56f40c404/src/index.ts#L161)

Creates a nested object of DOM references with a reverse lookup map.

#### Type Parameters

##### T

`T` *extends* `Element` = `Element`

#### Parameters

##### root

The root element or document to search (defaults to document.body)

`Element` | `Document`

##### options

`RefsOptions` = `{}`

Configuration for attribute names

#### Returns

`RefsHandle`\<`T`\> & `object`

A handle containing refs, reverseMap, and a clear method

#### Example

```html
<div data-ref="header.title">Title</div>
<div data-ref-array="items, list">Item</div>
```
```typescript
const { refs, clear } = createRefs();
console.log(refs.header.title); // <div> element
console.log(refs.items); // [<div>] array
clear(); // Removes all references
```

***

### refWatcher()

> **refWatcher**\<`T`\>(`refsHandle`, `root`, `selector`?, `options`?): `RefWatcher`

Defined in: [index.ts:222](https://github.com/tamb/dom-refs/blob/05845d8502d3fa248dccd44462b5b6f56f40c404/src/index.ts#L222)

Watches the DOM and updates the refs object dynamically, including removals.

#### Type Parameters

##### T

`T` *extends* `Element`

#### Parameters

##### refsHandle

`RefsHandle`\<`T`\>

The handle returned by createRefs

##### root

The root element or document to observe (defaults to document.body)

`Element` | `Document`

##### selector?

`string`

Optional CSS selector to filter elements

##### options?

`RefsOptions` = `{}`

Configuration for attribute names

#### Returns

`RefWatcher`

A RefWatcher with a stop method

#### Example

```typescript
const refsHandle = createRefs();
const watcher = refWatcher(refsHandle);
// DOM changes are now tracked
watcher.stop(); // Stops observing
```
