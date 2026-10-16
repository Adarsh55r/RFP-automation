"use client";

import { Fragment, useMemo } from "react";
import {
  parseMarkdown,
  relativeHeadingLevel,
  type InlineRun,
  type MdBlock,
} from "@/lib/markdown";
import { cn } from "@/lib/cn";

/**
 * Renders draft markdown the way the export will look. Built from the
 * shared parser (never dangerouslySetInnerHTML), so text from an uploaded
 * RFP can't inject markup.
 */

function Runs({ runs }: { runs: InlineRun[] }) {
  return (
    <>
      {runs.map((run, index) => {
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
}: {
  markdown: string;
  className?: string;
}) {
  const blocks = useMemo(() => parseMarkdown(markdown), [markdown]);
  const level = useMemo(() => relativeHeadingLevel(blocks), [blocks]);

  return (
    <div className={cn("text-sm text-ink", className)}>
      <Blocks blocks={blocks} level={level} />
    </div>
  );
}
