export type FlatSuite = { id: string; name: string; parentId: string | null; position?: number };

export type SuiteNode<T extends FlatSuite = FlatSuite> = T & { children: SuiteNode<T>[] };

export function buildTree<T extends FlatSuite>(suites: T[]): SuiteNode<T>[] {
  const byId = new Map<string, SuiteNode<T>>();
  for (const s of suites) byId.set(s.id, { ...s, children: [] });
  const roots: SuiteNode<T>[] = [];
  for (const node of byId.values()) {
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  const sort = (nodes: SuiteNode<T>[]) => {
    nodes.sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.name.localeCompare(b.name));
    nodes.forEach((n) => sort(n.children));
  };
  sort(roots);
  return roots;
}

export type SuiteOption = { id: string; name: string; depth: number; path: string; parentId: string | null };

/** Depth-first flattening, suitable for indented <select> options. */
export function flattenTree<T extends FlatSuite>(suites: T[]): SuiteOption[] {
  const out: SuiteOption[] = [];
  const walk = (nodes: SuiteNode<T>[], depth: number, prefix: string) => {
    for (const n of nodes) {
      const path = prefix ? `${prefix} > ${n.name}` : n.name;
      out.push({ id: n.id, name: n.name, depth, path, parentId: n.parentId });
      walk(n.children, depth + 1, path);
    }
  };
  walk(buildTree(suites), 0, "");
  return out;
}

export function descendantIds<T extends FlatSuite>(suites: T[], rootId: string): string[] {
  const childrenOf = new Map<string, string[]>();
  for (const s of suites) {
    if (!s.parentId) continue;
    const list = childrenOf.get(s.parentId) ?? [];
    list.push(s.id);
    childrenOf.set(s.parentId, list);
  }
  const out: string[] = [];
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    out.push(id);
    stack.push(...(childrenOf.get(id) ?? []));
  }
  return out;
}
