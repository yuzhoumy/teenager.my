import type { ReactNode } from "react";

function renderInlineMarkdown(text: string) {
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
        nodes.push(
          <a
            key={`link-${matchIndex}`}
            href={linkMatch[2]}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-brand underline decoration-brand/35 underline-offset-4 hover:text-brand-soft"
          >
            {linkMatch[1]}
          </a>,
        );
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

export function MarkdownRenderer({ markdown }: { markdown: string }) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let paragraphLines: string[] = [];
  let listItems: string[] = [];

  function flushParagraph() {
    if (paragraphLines.length === 0) return;
    const content = paragraphLines.join(" ").trim();
    blocks.push(
      <p key={`paragraph-${blocks.length}`} className="text-base leading-8 text-text-muted">
        {renderInlineMarkdown(content)}
      </p>,
    );
    paragraphLines = [];
  }

  function flushList() {
    if (listItems.length === 0) return;
    blocks.push(
      <ul key={`list-${blocks.length}`} className="list-disc space-y-2 pl-6 text-base leading-8 text-text-muted">
        {listItems.map((item, index) => (
          <li key={`item-${index}`}>{renderInlineMarkdown(item)}</li>
        ))}
      </ul>,
    );
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
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const Tag = level === 1 ? "h1" : level === 2 ? "h2" : "h3";

      blocks.push(
        <Tag
          key={`heading-${blocks.length}`}
          className={
            level === 1
              ? "text-4xl text-foreground"
              : level === 2
                ? "text-3xl text-foreground"
                : "text-2xl text-foreground"
          }
        >
          {renderInlineMarkdown(text)}
        </Tag>,
      );
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

  return <div className="markdown-content space-y-5">{blocks}</div>;
}
