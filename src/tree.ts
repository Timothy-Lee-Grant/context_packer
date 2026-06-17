/**
 * Builds an ASCII directory tree (the kind shown by the `tree` command) from
 * a flat list of POSIX-relative file paths. Output is deterministic:
 * directories are listed before files, each group sorted alphabetically.
 */

interface TreeNode {
  name: string;
  children: Map<string, TreeNode>;
  isFile: boolean;
}

function makeNode(name: string, isFile: boolean): TreeNode {
  return { name, children: new Map(), isFile };
}

/** Insert a path into the tree, creating intermediate directory nodes. */
function insert(root: TreeNode, relativePath: string): void {
  const parts = relativePath.split("/").filter(Boolean);
  let current = root;
  parts.forEach((part, index) => {
    const isLast = index === parts.length - 1;
    let child = current.children.get(part);
    if (!child) {
      child = makeNode(part, isLast);
      current.children.set(part, child);
    } else if (isLast) {
      // A file at a path previously seen only as a prefix — mark it a file.
      child.isFile = child.isFile || isLast;
    }
    current = child;
  });
}

/** Sort children: directories first, then files, each alphabetically. */
function sortedChildren(node: TreeNode): TreeNode[] {
  return [...node.children.values()].sort((a, b) => {
    const aDir = a.children.size > 0 || !a.isFile;
    const bDir = b.children.size > 0 || !b.isFile;
    if (aDir !== bDir) return aDir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

function render(node: TreeNode, prefix: string, lines: string[]): void {
  const children = sortedChildren(node);
  children.forEach((child, index) => {
    const isLast = index === children.length - 1;
    const connector = isLast ? "└── " : "├── ";
    const isDir = child.children.size > 0 || !child.isFile;
    const label = isDir ? `${child.name}/` : child.name;
    lines.push(`${prefix}${connector}${label}`);

    if (child.children.size > 0) {
      const childPrefix = prefix + (isLast ? "    " : "│   ");
      render(child, childPrefix, lines);
    }
  });
}

/**
 * Produce the tree as a string, rooted at ".". Returns just "." when there
 * are no files.
 */
export function buildTree(relativePaths: string[]): string {
  const root = makeNode(".", false);
  for (const p of relativePaths) {
    insert(root, p);
  }
  const lines: string[] = ["."];
  render(root, "", lines);
  return lines.join("\n");
}
