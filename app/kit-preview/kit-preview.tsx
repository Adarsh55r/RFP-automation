"use client";

import Link from "next/link";
import { Logo } from "@/components/brand";
import { cn } from "@/lib/cn";
import { focusRingOnDark } from "@/lib/focus";
import { FileStack, Inbox } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  EmptyState,
  Input,
  Select,
  Skeleton,
  SkeletonText,
  Textarea,
  useToast,
} from "@/components/ui";

function Section({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="border-t border-border py-12">
      <p className="mb-6 font-mono text-xs tracking-wide text-slate uppercase">
        {label}
      </p>
      {children}
    </section>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {hint ? <p className="text-sm text-slate">{hint}</p> : null}
    </div>
  );
}

export function KitPreview() {
  const { toast } = useToast();

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-border bg-brand-dark">
        <div className="mx-auto flex max-w-content items-center justify-between px-8 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className={cn(focusRingOnDark, "inline-flex rounded-control text-surface-raised")}
            >
              <Logo />
            </Link>
            <p className="font-mono text-xs tracking-wide text-surface-raised/70 uppercase">
              Kit
            </p>
          </div>
          <Link
            href="/"
            className="rounded-control px-2 py-2 font-sans text-sm font-medium text-surface-raised/80 transition-colors duration-hover ease-out hover:text-surface-raised focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-brand-dark focus-visible:outline-none"
          >
            Back to home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-content px-8 py-12">
        <h1 className="font-display text-5xl font-medium text-ink">
          Component kit
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate">
          Temporary review surface for every primitive and variant. Tab through
          to check focus rings — they are required, not optional.
        </p>

        <nav className="mt-8 flex flex-wrap gap-2">
          {[
            ["buttons", "Buttons"],
            ["cards", "Cards"],
            ["forms", "Forms"],
            ["badges", "Badges"],
            ["dialog", "Dialog"],
            ["toasts", "Toasts"],
            ["skeletons", "Skeletons"],
            ["empty", "Empty state"],
          ].map(([href, label]) => (
            <a
              key={href}
              href={`#${href}`}
              className="rounded-control border border-border bg-surface-raised px-4 py-2 text-sm font-medium text-ink transition-[transform,box-shadow] duration-hover ease-out hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgb(11_31_51_/_0.08)] focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface focus-visible:outline-none"
            >
              {label}
            </a>
          ))}
        </nav>

        <Section id="buttons" label="Button">
          <div className="flex flex-col gap-8">
            <div className="flex flex-wrap items-center gap-4">
              <Button variant="primary">Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger">Danger</Button>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <Button size="sm">Small</Button>
              <Button size="md">Medium</Button>
              <Button size="lg">Large</Button>
              <Button disabled>Disabled</Button>
              <Button variant="secondary" disabled>
                Disabled secondary
              </Button>
            </div>
          </div>
        </Section>

        <Section id="cards" label="Card">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <p className="font-mono text-xs tracking-wide text-slate">
                RFP-2026-0441
              </p>
              <h2 className="mt-2 font-sans text-xl font-semibold text-ink">
                Default card
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate">
                Raised surface for static content — proposal summaries, RFP
                metadata, and reading panes.
              </p>
            </Card>
            <Card variant="interactive">
              <p className="font-mono text-xs tracking-wide text-slate">
                RFP-2026-0442
              </p>
              <h2 className="mt-2 font-sans text-xl font-semibold text-ink">
                Interactive card
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate">
                Hover lifts 2px with a light shadow. Focus with the keyboard to
                see the brand ring. Tab here.
              </p>
            </Card>
          </div>
        </Section>

        <Section id="forms" label="Input · Textarea · Select">
          <Card className="grid gap-6 md:grid-cols-2">
            <Field label="Client name" htmlFor="client-name">
              <Input id="client-name" name="client-name" placeholder="Acme Infotech Pvt Ltd" />
            </Field>
            <Field label="Disabled" htmlFor="disabled-input">
              <Input
                id="disabled-input"
                name="disabled-input"
                placeholder="Read only"
                disabled
                defaultValue="Imported from portal"
              />
            </Field>
            <Field
              label="Deadline"
              htmlFor="deadline"
              hint="Invalid state uses the danger token."
            >
              <Input
                id="deadline"
                name="deadline"
                type="date"
                aria-invalid="true"
                defaultValue="2024-01-01"
              />
            </Field>
            <Field label="Engagement type" htmlFor="engagement">
              <Select id="engagement" name="engagement" defaultValue="fixed">
                <option value="fixed">Fixed bid</option>
                <option value="t-m">Time & materials</option>
                <option value="staff">Staff augmentation</option>
              </Select>
            </Field>
            <Field
              label="Scope notes"
              htmlFor="scope"
              hint="Grows vertically. Focus ring matches inputs."
              className="md:col-span-2"
            >
              <Textarea
                id="scope"
                name="scope"
                placeholder="Summarise modules, SLAs, and onshore/offshore split…"
              />
            </Field>
          </Card>
        </Section>

        <Section id="badges" label="Badge">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="draft">Draft</Badge>
            <Badge variant="submitted">Submitted</Badge>
            <Badge variant="free">Free tier</Badge>
            <Badge variant="success">Accepted</Badge>
            <Badge variant="danger">Overdue</Badge>
            <Badge variant="accent">Ready to send</Badge>
          </div>
        </Section>

        <Section id="dialog" label="Dialog">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="secondary">Open submit dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Submit proposal?</DialogTitle>
                <DialogDescription>
                  This marks RFP-2026-0441 as submitted. You can still download
                  the Word file afterwards.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="ghost">Cancel</Button>
                </DialogClose>
                <Button>Submit proposal</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </Section>

        <Section id="toasts" label="Toast">
          <div className="flex flex-wrap gap-4">
            <Button
              variant="secondary"
              onClick={() =>
                toast({
                  variant: "success",
                  title: "Proposal exported",
                  description: "RFP-2026-0441.docx is ready to download.",
                })
              }
            >
              Success toast
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                toast({
                  variant: "error",
                  title: "Parse failed",
                  description: "We could not read page 14 of the RFP PDF.",
                })
              }
            >
              Error toast
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                toast({
                  variant: "info",
                  title: "Processing RFP",
                  description: "Extracting requirements — this usually takes under a minute.",
                })
              }
            >
              Info toast
            </Button>
          </div>
        </Section>

        <Section id="skeletons" label="Skeleton">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <Skeleton className="h-6 w-32" />
              <SkeletonText className="mt-6" lines={4} />
              <Skeleton className="mt-6 h-10 w-40" />
            </Card>
            <Card>
              <div className="flex gap-4">
                <Skeleton className="size-12 rounded-card" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="mt-2 h-4 w-full" />
                  <Skeleton className="mt-2 h-4 w-3/4" />
                </div>
              </div>
              <p className="mt-6 font-mono text-xs tracking-wide text-slate">
                RFP processing placeholder
              </p>
            </Card>
          </div>
        </Section>

        <Section id="empty" label="EmptyState">
          <div className="grid gap-6">
            <EmptyState
              icon={Inbox}
              headline="No RFPs yet"
              description="Upload an RFP PDF or Word file to draft the first proposal for your pipeline."
              action={<Button>Upload RFP</Button>}
            />
            <EmptyState
              icon={FileStack}
              headline="No case studies yet"
              description="Add 2–3 past engagements so DraftWin can cite relevant proof when it writes."
            />
          </div>
        </Section>
      </main>
    </div>
  );
}
