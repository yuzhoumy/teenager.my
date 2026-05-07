import { useEffect, useRef, useState, type FocusEvent, type KeyboardEvent, type ReactNode } from "react";

type AttachmentRenderCallback = (href: string, label: string, index: number) => ReactNode;

type MarkdownRendererProps = {
  markdown: string;
  editable?: boolean;
  onMarkdownChange?: (nextMarkdown: string) => void;
  renderPdfLink?: AttachmentRenderCallback;
  renderImageLink?: AttachmentRenderCallback;
};

type ParsedBlock =
  | { kind: "heading"; level: 1 | 2 | 3; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; items: string[] };

function hasBlockElement(children: ReactNode[]) {
  const blockTags = new Set(["div", "p", "h1", "h2", "h3", "ul", "ol", "li", "figure", "section", "article"]);

  return children.some((child) => {
    if (!child || typeof child !== "object") {
      return false;
    }

    const element = child as { type?: unknown };
    if (typeof element.type === "string") {
      return blockTags.has(element.type);
    }

    return element.type !== undefined;
  });
}

function isImageLink(url: string) {
  return /\.(png|jpe?g|gif|webp|svg|avif)($|[?#])/i.test(url);
}

function parseBlocks(markdown: string) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: ParsedBlock[] = [];
  let paragraphLines: string[] = [];
  let listItems: string[] = [];

  function flushParagraph() {
    if (paragraphLines.length === 0) return;
    blocks.push({ kind: "paragraph", text: paragraphLines.join(" ").trim() });
    paragraphLines = [];
  }

  function flushList() {
    if (listItems.length === 0) return;
    blocks.push({ kind: "list", items: [...listItems] });
    listItems = [];
  }

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      blocks.push({
        kind: "heading",
        level: headingMatch[1].length as 1 | 2 | 3,
        text: headingMatch[2],
      });
      continue;
    }

    const listMatch = trimmed.match(/^[-*]\s+(.*)$/);
    if (listMatch) {
      flushParagraph();
      listItems.push(listMatch[1]);
      continue;
    }

    paragraphLines.push(trimmed);
  }

  flushParagraph();
  flushList();

  return blocks;
}

function stringifyBlocks(blocks: ParsedBlock[]) {
  return blocks
    .filter((block) => {
      if (block.kind === "list") {
        return block.items.length > 0;
      }

      return block.text.trim().length > 0;
    })
    .map((block) => {
      if (block.kind === "heading") {
        return `${"#".repeat(block.level)} ${block.text}`.trimEnd();
      }

      if (block.kind === "paragraph") {
        return block.text;
      }

      return block.items.filter((item) => item.trim().length > 0).map((item) => `- ${item}`.trimEnd()).join("\n");
    })
    .join("\n\n");
}

function renderInlineMarkdown(
  text: string,
  renderPdfLink?: AttachmentRenderCallback,
  renderImageLink?: AttachmentRenderCallback,
) {
  const nodes: ReactNode[] = [];
  const pattern = /(\[[^\]]+\]\([^)]+\)|`[^`]+`|\*\*[^*]+\*\*)/g;
  let lastIndex = 0;
  let matchIndex = 0;

  for (const match of text.matchAll(pattern)) {
    const matchedText = match[0];
    const start = match.index ?? 0;

    if (start > lastIndex) {
      nodes.push(text.slice(lastIndex, start));
    }

    if (matchedText.startsWith("[")) {
      const linkMatch = matchedText.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        const label = linkMatch[1];
        const href = linkMatch[2];

        if (renderPdfLink && /\.pdf($|[?#])/i.test(href)) {
          nodes.push(renderPdfLink(href, label, matchIndex));
        } else if (renderImageLink && isImageLink(href)) {
          nodes.push(renderImageLink(href, label, matchIndex));
        } else {
          nodes.push(
            <a
              key={`link-${matchIndex}`}
              href={href}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-brand underline decoration-brand/35 underline-offset-4 hover:text-brand-soft"
            >
              {label}
            </a>,
          );
        }
      } else {
        nodes.push(matchedText);
      }
    } else if (matchedText.startsWith("`")) {
      nodes.push(
        <code
          key={`code-${matchIndex}`}
          className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-[0.95em] text-foreground"
        >
          {matchedText.slice(1, -1)}
        </code>,
      );
    } else if (matchedText.startsWith("**")) {
      nodes.push(
        <strong key={`strong-${matchIndex}`} className="font-semibold text-foreground">
          {matchedText.slice(2, -2)}
        </strong>,
      );
    } else {
      nodes.push(matchedText);
    }

    lastIndex = start + matchedText.length;
    matchIndex += 1;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

function isEditableText(children: ReactNode[]) {
  return !hasBlockElement(children);
}

function splitEditableLines(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function EditableMarkdownTextarea({
  className,
  editId,
  value,
  rows,
  onCommit,
  onSplit,
  onFinish,
}: {
  className: string;
  editId: string;
  value: string;
  rows: number;
  onCommit: (nextText: string) => void;
  onSplit?: (beforeText: string, afterText: string) => void;
  onFinish?: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const focusedRef = useRef(false);
  const skipNextBlurCommitRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) {
      setDraft(value);
    }
  }, [value]);

  return (
    <textarea
      data-markdown-edit-id={editId}
      className={className}
      value={draft}
      rows={Math.max(rows, draft.split("\n").length)}
      onFocus={() => {
        focusedRef.current = true;
      }}
      onChange={(event) => setDraft(event.currentTarget.value)}
      onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key !== "Enter" || event.shiftKey || !onSplit) {
          return;
        }

        event.preventDefault();
        skipNextBlurCommitRef.current = true;
        const selectionStart = event.currentTarget.selectionStart;
        const selectionEnd = event.currentTarget.selectionEnd;
        const beforeText = draft.slice(0, selectionStart);
        const afterText = draft.slice(selectionEnd);
        onSplit(beforeText, afterText);
      }}
      onBlur={(event: FocusEvent<HTMLTextAreaElement>) => {
        focusedRef.current = false;
        if (skipNextBlurCommitRef.current) {
          skipNextBlurCommitRef.current = false;
          return;
        }

        const nextText = event.currentTarget.value;
        if (nextText !== value) {
          onCommit(nextText);
        }

        onFinish?.();
      }}
    />
  );
}

export function MarkdownRenderer({
  markdown,
  editable = false,
  onMarkdownChange,
  renderPdfLink,
  renderImageLink,
}: MarkdownRendererProps) {
  const parsedBlocks = parseBlocks(markdown);
  const [editableBlocks, setEditableBlocks] = useState<ParsedBlock[]>(parsedBlocks);
  const [activeEditId, setActiveEditId] = useState<string | null>(null);
  const activeEditIdRef = useRef<string | null>(null);
  const pendingFocusPositionRef = useRef<"start" | "end">("end");
  const committedMarkdownRef = useRef(markdown);

  useEffect(() => {
    if (markdown === committedMarkdownRef.current) {
      return;
    }

    committedMarkdownRef.current = markdown;
    setEditableBlocks(parseBlocks(markdown));
  }, [markdown]);

  useEffect(() => {
    if (!activeEditId) {
      return;
    }

    const textarea = document.querySelector<HTMLTextAreaElement>(`[data-markdown-edit-id="${activeEditId}"]`);
    if (!textarea) {
      return;
    }

    const position = pendingFocusPositionRef.current;
    pendingFocusPositionRef.current = "end";
    const cursorPosition = position === "start" ? 0 : textarea.value.length;
    textarea.focus();
    textarea.setSelectionRange(cursorPosition, cursorPosition);
  }, [activeEditId, editableBlocks]);

  const blocks = editable && onMarkdownChange ? editableBlocks : parsedBlocks;

  function activateEditId(editId: string, position: "start" | "end" = "end") {
    pendingFocusPositionRef.current = position;
    activeEditIdRef.current = editId;
    setActiveEditId(editId);
  }

  function deactivateEditId(editId: string) {
    if (activeEditIdRef.current !== editId) {
      return;
    }

    activeEditIdRef.current = null;
    setActiveEditId(null);
  }

  function commitBlocks(nextBlocks: ParsedBlock[]) {
    if (!onMarkdownChange) {
      return;
    }

    const nextMarkdown = stringifyBlocks(nextBlocks);
    committedMarkdownRef.current = nextMarkdown;
    setEditableBlocks(nextBlocks);
    onMarkdownChange(nextMarkdown);
  }

  function updateBlock(blockIndex: number, updater: (block: ParsedBlock) => ParsedBlock) {
    if (!onMarkdownChange) {
      return;
    }

    const nextBlocks = blocks.map((block, index) => (index === blockIndex ? updater(block) : block));
    commitBlocks(nextBlocks);
  }

  function replaceBlock(blockIndex: number, nextBlocksForIndex: ParsedBlock[], focusEditId?: string) {
    if (!onMarkdownChange) {
      return;
    }

    if (focusEditId) {
      activateEditId(focusEditId, "start");
    }

    const nextBlocks = blocks.flatMap((block, index) => (index === blockIndex ? nextBlocksForIndex : [block]));
    commitBlocks(nextBlocks);
  }

  function commitTextBlock(blockIndex: number, block: ParsedBlock, nextText: string) {
    const lines = splitEditableLines(nextText);

    if (lines.length === 0) {
      replaceBlock(blockIndex, []);
      return;
    }

    if (lines.length <= 1) {
      updateBlock(blockIndex, (currentBlock) => {
        if (currentBlock.kind === "heading") {
          return { ...currentBlock, text: lines[0] };
        }

        if (currentBlock.kind === "paragraph") {
          return { ...currentBlock, text: lines[0] };
        }

        return currentBlock;
      });
      return;
    }

    const nextBlocksForIndex: ParsedBlock[] =
      block.kind === "heading"
        ? [
            { ...block, text: lines[0] },
            ...lines.slice(1).map((line): ParsedBlock => ({ kind: "paragraph", text: line })),
          ]
        : lines.map((line): ParsedBlock => ({ kind: "paragraph", text: line }));

    replaceBlock(blockIndex, nextBlocksForIndex, `block-${blockIndex + 1}`);
  }

  function splitTextBlock(blockIndex: number, block: ParsedBlock, beforeText: string, afterText: string) {
    const beforeLine = beforeText.trim();
    const afterLine = afterText.trim();
    const nextBlocksForIndex: ParsedBlock[] = [];

    if (block.kind === "heading") {
      nextBlocksForIndex.push({ ...block, text: beforeLine });
      nextBlocksForIndex.push({ kind: "paragraph", text: afterLine });
      replaceBlock(blockIndex, nextBlocksForIndex, `block-${blockIndex + 1}`);
      return;
    }

    if (beforeLine) {
      nextBlocksForIndex.push({ kind: "paragraph", text: beforeLine });
    }

    nextBlocksForIndex.push({ kind: "paragraph", text: afterLine });
    replaceBlock(blockIndex, nextBlocksForIndex, `block-${blockIndex + (beforeLine ? 1 : 0)}`);
  }

  function splitListItem(blockIndex: number, itemIndex: number, beforeText: string, afterText: string) {
    const beforeLine = beforeText.trim();
    const afterLine = afterText.trim();
    let focusIndex = itemIndex;

    const nextBlocks = blocks.map((block, index) => {
      if (index !== blockIndex || block.kind !== "list") {
        return block;
      }

      const nextItems = block.items.flatMap((item, currentIndex) => {
        if (currentIndex !== itemIndex) {
          return [item];
        }

        const replacementItems = beforeLine ? [beforeLine, afterLine] : [afterLine];
        focusIndex = currentIndex + (beforeLine ? 1 : 0);
        return replacementItems;
      });

      return { ...block, items: nextItems };
    });

    activateEditId(`list-${blockIndex}-${focusIndex}`, "start");
    commitBlocks(nextBlocks);
  }

  function renderEditableTextBlock(
    blockIndex: number,
    block: ParsedBlock,
    className: string,
    children: ReactNode[],
  ) {
    const editableText =
      block.kind === "heading" || block.kind === "paragraph"
        ? block.text
        : "";

    if (!editable || !onMarkdownChange || !isEditableText(children) || block.kind === "list") {
      const Tag = block.kind === "heading"
        ? (block.level === 1 ? "h1" : block.level === 2 ? "h2" : "h3")
        : "p";

      return (
        <Tag key={`block-${blockIndex}`} className={className}>
          {children}
        </Tag>
      );
    }

    const editId = `block-${blockIndex}`;
    const Tag = block.kind === "heading"
      ? (block.level === 1 ? "h1" : block.level === 2 ? "h2" : "h3")
      : "p";

    if (activeEditId !== editId) {
      return (
        <Tag
          key={`block-${blockIndex}`}
          className={`${className} min-h-8 cursor-text rounded-xl px-2 py-1 transition hover:bg-surface-strong`}
          role="button"
          tabIndex={0}
          onClick={() => activateEditId(editId)}
          onKeyDown={(event: KeyboardEvent<HTMLElement>) => {
            if (event.key !== "Enter" && event.key !== " ") {
              return;
            }

            event.preventDefault();
            activateEditId(editId);
          }}
        >
          {children.length > 0 ? children : <span className="text-text-soft">Start typing...</span>}
        </Tag>
      );
    }

    return (
      <EditableMarkdownTextarea
        key={`block-${blockIndex}`}
        editId={editId}
        className={`${className} block w-full resize-y rounded-xl border border-transparent bg-transparent px-2 py-1 outline-none transition hover:bg-surface-strong focus:border-border focus:bg-surface-strong focus:ring-2 focus:ring-focus`}
        value={editableText}
        rows={block.kind === "heading" ? 1 : Math.max(2, Math.ceil(editableText.length / 90))}
        onCommit={(nextText) => commitTextBlock(blockIndex, block, nextText)}
        onSplit={(beforeText, afterText) => splitTextBlock(blockIndex, block, beforeText, afterText)}
        onFinish={() => deactivateEditId(editId)}
      />
    );
  }

  const renderedBlocks = blocks.map((block, blockIndex) => {
    if (block.kind === "heading") {
      const children = renderInlineMarkdown(block.text, renderPdfLink, renderImageLink);
      const className =
        block.level === 1
          ? "text-4xl text-foreground"
          : block.level === 2
            ? "text-3xl text-foreground"
            : "text-2xl text-foreground";

      if (isEditableText(children)) {
        return renderEditableTextBlock(blockIndex, block, className, children);
      }

      return (
        <div key={`block-${blockIndex}`} className="space-y-5">
          {children}
        </div>
      );
    }

    if (block.kind === "paragraph") {
      const children = renderInlineMarkdown(block.text, renderPdfLink, renderImageLink);
      if (isEditableText(children)) {
        return renderEditableTextBlock(blockIndex, block, "text-base leading-8 text-text-muted", children);
      }

      return (
        <div key={`block-${blockIndex}`} className="space-y-5">
          {children}
        </div>
      );
    }

    return (
      <ul key={`block-${blockIndex}`} className="list-disc space-y-2 pl-6 text-base leading-8 text-text-muted">
        {block.items.map((item, itemIndex) => {
          const children = renderInlineMarkdown(item, renderPdfLink, renderImageLink);

          if (!editable || !onMarkdownChange || !isEditableText(children)) {
            return <li key={`item-${itemIndex}`}>{children}</li>;
          }

          return (
            <li
              key={`item-${itemIndex}`}
              className="rounded-xl px-2 py-1 transition hover:bg-surface-strong"
            >
              {activeEditId === `list-${blockIndex}-${itemIndex}` ? (
                <EditableMarkdownTextarea
                  editId={`list-${blockIndex}-${itemIndex}`}
                  className="block w-full resize-y rounded-lg border border-transparent bg-transparent px-2 py-1 text-base leading-7 text-text-muted outline-none focus:border-border focus:bg-surface-strong focus:ring-2 focus:ring-focus"
                  value={item}
                  rows={1}
                  onSplit={(beforeText, afterText) => splitListItem(blockIndex, itemIndex, beforeText, afterText)}
                  onCommit={(nextText) => {
                    const nextItemsFromText = splitEditableLines(nextText);

                    updateBlock(blockIndex, (currentBlock) => {
                      if (currentBlock.kind !== "list") {
                        return currentBlock;
                      }

                      const nextItems = currentBlock.items.flatMap((currentItem, currentIndex) => {
                        if (currentIndex !== itemIndex) {
                          return [currentItem];
                        }

                        return nextItemsFromText.length > 0 ? nextItemsFromText : [];
                      });
                      return { ...currentBlock, items: nextItems };
                    });
                  }}
                  onFinish={() => deactivateEditId(`list-${blockIndex}-${itemIndex}`)}
                />
              ) : (
                <div
                  className="min-h-7 cursor-text rounded-lg px-2 py-1 transition hover:bg-surface-strong"
                  role="button"
                  tabIndex={0}
                  onClick={() => activateEditId(`list-${blockIndex}-${itemIndex}`)}
                  onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
                    if (event.key !== "Enter" && event.key !== " ") {
                      return;
                    }

                    event.preventDefault();
                    activateEditId(`list-${blockIndex}-${itemIndex}`);
                  }}
                >
                  {children.length > 0 ? children : <span className="text-text-soft">Start typing...</span>}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    );
  });

  return <div className="markdown-content space-y-5">{renderedBlocks}</div>;
}
