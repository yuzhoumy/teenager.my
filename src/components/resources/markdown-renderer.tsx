import type { FocusEvent, ReactNode } from "react";

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
    .map((block) => {
      if (block.kind === "heading") {
        return `${"#".repeat(block.level)} ${block.text}`.trimEnd();
      }

      if (block.kind === "paragraph") {
        return block.text;
      }

      return block.items.map((item) => `- ${item}`.trimEnd()).join("\n");
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

export function MarkdownRenderer({
  markdown,
  editable = false,
  onMarkdownChange,
  renderPdfLink,
  renderImageLink,
}: MarkdownRendererProps) {
  const blocks = parseBlocks(markdown);

  function updateBlock(blockIndex: number, updater: (block: ParsedBlock) => ParsedBlock) {
    if (!onMarkdownChange) {
      return;
    }

    const nextBlocks = blocks.map((block, index) => (index === blockIndex ? updater(block) : block));
    onMarkdownChange(stringifyBlocks(nextBlocks));
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

    return (
      <textarea
        key={`block-${blockIndex}-${editableText}`}
        className={`${className} block w-full resize-y rounded-xl border border-transparent bg-transparent px-2 py-1 outline-none transition hover:bg-surface-strong focus:border-border focus:bg-surface-strong focus:ring-2 focus:ring-focus`}
        defaultValue={editableText}
        rows={block.kind === "heading" ? 1 : Math.max(2, Math.ceil(editableText.length / 90))}
        onBlur={(event: FocusEvent<HTMLTextAreaElement>) => {
          const nextText = event.currentTarget.value;
          if (nextText === editableText) {
            return;
          }

          updateBlock(blockIndex, (currentBlock) => {
            if (currentBlock.kind === "heading") {
              return { ...currentBlock, text: nextText };
            }

            if (currentBlock.kind === "paragraph") {
              return { ...currentBlock, text: nextText };
            }

            return currentBlock;
          });
        }}
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
              <textarea
                className="block w-full resize-y rounded-lg border border-transparent bg-transparent px-2 py-1 text-base leading-7 text-text-muted outline-none focus:border-border focus:bg-surface-strong focus:ring-2 focus:ring-focus"
                defaultValue={item}
                rows={1}
                onBlur={(event: FocusEvent<HTMLTextAreaElement>) => {
                  const nextText = event.currentTarget.value;
                  if (nextText === item) {
                    return;
                  }

                  updateBlock(blockIndex, (currentBlock) => {
                    if (currentBlock.kind !== "list") {
                      return currentBlock;
                    }

                    const nextItems = currentBlock.items.map((currentItem, currentIndex) =>
                      currentIndex === itemIndex ? nextText : currentItem,
                    );
                    return { ...currentBlock, items: nextItems };
                  });
                }}
              />
            </li>
          );
        })}
      </ul>
    );
  });

  return <div className="markdown-content space-y-5">{renderedBlocks}</div>;
}
