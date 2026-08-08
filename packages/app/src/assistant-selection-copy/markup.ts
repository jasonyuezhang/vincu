export const MARKDOWN_COPY_TAG_ATTRIBUTE = "data-vincu-markdown-tag";
export const MARKDOWN_COPY_IGNORE_ATTRIBUTE = "data-vincu-markdown-ignore";
export const MARKDOWN_COPY_UNWRAP_ATTRIBUTE = "data-vincu-markdown-unwrap";
export const MARKDOWN_COPY_LIST_START_ATTRIBUTE = "data-vincu-markdown-list-start";
export const MARKDOWN_COPY_LANGUAGE_ATTRIBUTE = "data-vincu-markdown-language";
export const MARKDOWN_COPY_ALIGN_ATTRIBUTE = "data-vincu-markdown-align";

/**
 * Trailing line breaks, with any indentation that followed the last one.
 *
 * Both ways of copying code strip these, for the same reason: pasting a trailing
 * newline into a terminal runs the last line. A fence body always ends in one, and
 * ends in several when the author left blank lines before the closing fence; a
 * selection picks one up whenever it overshoots the end of a rendered line.
 */
export const TRAILING_CODE_LINE_BREAKS = /(\r?\n[ \t]*)+$/;

export const markdownCopyDataSet = {
  blockquote: { vincuMarkdownTag: "blockquote" },
  br: { vincuMarkdownTag: "br" },
  code: { vincuMarkdownTag: "code" },
  h1: { vincuMarkdownTag: "h1" },
  h2: { vincuMarkdownTag: "h2" },
  h3: { vincuMarkdownTag: "h3" },
  h4: { vincuMarkdownTag: "h4" },
  h5: { vincuMarkdownTag: "h5" },
  h6: { vincuMarkdownTag: "h6" },
  hr: { vincuMarkdownTag: "hr" },
  ignore: { vincuMarkdownIgnore: "true" },
  li: { vincuMarkdownTag: "li" },
  ol: { vincuMarkdownTag: "ol" },
  p: { vincuMarkdownTag: "p" },
  pre: { vincuMarkdownTag: "pre" },
  s: { vincuMarkdownTag: "s" },
  strong: { vincuMarkdownTag: "strong" },
  em: { vincuMarkdownTag: "em" },
  table: { vincuMarkdownTag: "table" },
  tbody: { vincuMarkdownTag: "tbody" },
  td: { vincuMarkdownTag: "td" },
  th: { vincuMarkdownTag: "th" },
  thead: { vincuMarkdownTag: "thead" },
  tr: { vincuMarkdownTag: "tr" },
  ul: { vincuMarkdownTag: "ul" },
  unwrap: { vincuMarkdownUnwrap: "true" },
} as const;

export type MarkdownCopyInlineTag = "br" | "code" | "em" | "s" | "strong";

export function markdownCopyOrderedListDataSet(start: unknown) {
  return {
    ...markdownCopyDataSet.ol,
    vincuMarkdownListStart: String(start ?? 1),
  } as const;
}

export function markdownCopyCodeBlockDataSet(language: string | null | undefined) {
  const fenceLanguage = language?.trim().split(/\s+/)[0];
  return {
    ...markdownCopyDataSet.pre,
    ...(fenceLanguage ? { vincuMarkdownLanguage: fenceLanguage } : {}),
  } as const;
}

export function markdownCopyTableCellDataSet(tag: "td" | "th", style: unknown) {
  const alignment =
    typeof style === "string"
      ? style.match(/(?:^|;)\s*text-align\s*:\s*(left|right|center)/i)?.[1]
      : null;
  return {
    ...markdownCopyDataSet[tag],
    ...(alignment ? { vincuMarkdownAlign: alignment.toLowerCase() } : {}),
  } as const;
}
