"use client";

import { Fragment, createContext, useContext, useId, useMemo, useState } from "react";
import type { CitationSource } from "@/lib/citations";
import {
  parseMarkdown,
  relativeHeadingLevel,
  type InlineRun,
  type MdBlock,
} from "@/lib/markdown";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/focus";

const SourcesContext = createContext<Record<string, CitationSource> | null>(null);

/** A [S3] marker: opens the library passage the claim came from. */
function CitationChip({ ids }: { ids: string[] }) {
  const sources = useContext(SourcesContext);
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const found = ids.map((id) => ({ id, source: sources?.[id] }));
  // While a section is still streaming nothing has been checked yet.
  const checked = sources !== null;
  const missing = checked && found.some((item) => !item.source);
  return (
    <span className="relative inline-block align-baseline">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        title="Show the library passage this claim came from"
        className={cn(
          "mx-0.5 rounded px-1 font-mono text-[10px] leading-4 font-medium",
          missing ? "bg-danger/10 text-danger" : "bg-brand/10 text-brand hover:bg-brand/20",
          focusRing,
        )}
      >
        {ids.join(", ")}
      </button>
      {open ? (
        <span
          id={panelId}
          role="note"
          className="absolute left-0 z-20 mt-1 block w-72 max-w-[80vw] rounded-control border border-border bg-surface-raised p-3 text-left text-xs leading-relaxed text-ink shadow-lg"
        >
          {found.map(({ id, source }) => (
            <span key={id} className="mb-2 block last:mb-0">
              <span className="block font-mono text-[10px] text-slate uppercase">
                {id} · {source ? source.title : checked ? "Not found in your library" : "Checking…"}
              </span>
              <span className="mt-1 block">
                {source
                  ? source.excerpt
                  : checked
                    ? "This marker does not point to a library passage. Check the claim or remove it."
                    : "Sources are checked when this section finishes writing."}
              </span>
            </span>
          ))}
        </span>
      ) : null}
    </span>
  );
}

/**
 * Renders draft markdown the way the export will look. Built from the
 * shared parser (never dangerouslySetInnerHTML), so text from an uploaded
 * RFP can't inject markup.
 */

function Runs({ runs }: { runs: InlineRun[] }) {
  return (
    <>
      {runs.map((run, index) => {
        if (run.citation) {
          return <CitationChip key={index} ids={run.citation} />;
        }
        let node: React.ReactNode = run.text.split("\n").map((part, partIndex) => (
          <Fragment key={partIndex}>
            {partIndex > 0 ? <br /> : null}
            {part}
          </Fragment>
        ));
        if (run.code) node = <code className="rounded bg-surface px-1 font-mono text-[0.85em]">{node}</code>;
        if (run.bold) node = <strong className="font-semibold">{node}</strong>;
        if (run.italic) node = <em>{node}</em>;
        if (run.strike) node = <s>{node}</s>;
        if (run.placeholder) {
          node = (
            <mark
              className="rounded bg-accent/30 px-1 font-semibold text-ink"
              title="Needs your input before you submit"
            >
              {node}
            </mark>
          );
        }
        return <Fragment key={index}>{node}</Fragment>;
      })}
    </>
  );
}

function Blocks({
  blocks,
  level,
}: {
  blocks: MdBlock[];
  level: (depth: number) => number;
}) {
  return (
    <>
      {blocks.map((block, index) => {
        switch (block.type) {
          case "heading": {
            const relative = level(block.level);
            const className =
              relative === 1
                ? "mt-6 mb-2 font-sans text-base font-semibold text-brand first:mt-0"
                : relative === 2
                  ? "mt-4 mb-2 font-sans text-sm font-semibold text-ink first:mt-0"
                  : "mt-3 mb-1 font-sans text-sm font-semibold text-slate first:mt-0";
            return (
              <p key={index} className={className} role="heading" aria-level={relative + 2}>
                <Runs runs={block.runs} />
              </p>
            );
          }
          case "paragraph":
            return (
              <p key={index} className="mb-3 leading-relaxed last:mb-0">
                <Runs runs={block.runs} />
              </p>
            );
          case "list": {
            const items = block.items.map((item, itemIndex) => (
              <li key={itemIndex} className="pl-1 [&>p]:mb-1">
                <Blocks blocks={item} level={level} />
              </li>
            ));
            return block.ordered ? (
              <ol key={index} start={block.start} className="mb-3 list-decimal space-y-1 pl-6">
                {items}
              </ol>
            ) : (
              <ul key={index} className="mb-3 list-disc space-y-1 pl-6">
                {items}
              </ul>
            );
          }
          case "table":
            return (
              <div key={index} className="mb-4 overflow-x-auto rounded-control border border-border">
                <table className="w-full border-collapse text-left text-[13px]">
                  <thead className="bg-brand/10">
                    <tr>
                      {block.header.map((cell, cellIndex) => (
                        <th
                          key={cellIndex}
                          className="border-b border-border px-3 py-2 font-semibold text-brand"
                          style={{ textAlign: block.align[cellIndex] ?? "left" }}
                        >
                          <Runs runs={cell} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, rowIndex) => (
                      <tr key={rowIndex} className="border-b border-border last:border-b-0 even:bg-surface">
                        {block.header.map((_, cellIndex) => (
                          <td
                            key={cellIndex}
                            className="px-3 py-2 align-top"
                            style={{ textAlign: block.align[cellIndex] ?? "left" }}
                          >
                            <Runs runs={row[cellIndex] ?? []} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "quote":
            return (
              <blockquote key={index} className="mb-4 rounded-r-control border-l-4 border-brand bg-brand/5 px-4 py-3 text-ink">
                <Blocks blocks={block.blocks} level={level} />
              </blockquote>
            );
          case "code":
            return (
              <pre key={index} className="mb-3 overflow-x-auto rounded-control bg-surface p-3 font-mono text-xs">
                {block.text}
              </pre>
            );
          case "hr":
            return <hr key={index} className="my-4 border-border" />;
          default:
            return null;
        }
      })}
    </>
  );
}

export function MarkdownPreview({
  markdown,
  className,
  sources,
}: {
  markdown: string;
  className?: string;
  /** What each [S#] citation marker points to; markers render as clickable chips. */
  sources?: Record<string, CitationSource>;
}) {
  const blocks = useMemo(() => parseMarkdown(markdown), [markdown]);
  const level = useMemo(() => relativeHeadingLevel(blocks), [blocks]);

  return (
    <SourcesContext.Provider value={sources ?? null}>
      <div className={cn("text-sm text-ink", className)}>
        <Blocks blocks={blocks} level={level} />
      </div>
    </SourcesContext.Provider>
  );
}
