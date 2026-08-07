# DraftWin

B2B SaaS that turns RFP documents into polished proposals for Indian IT services agencies.

## Stack

- Next.js 15 (App Router) · TypeScript · Tailwind CSS
- Clerk auth · framer-motion · clsx · lucide-react · Radix UI

## Design system

All UI must follow [`.cursor/rules/design-system.md`](.cursor/rules/design-system.md). Tokens live in `app/globals.css` and are exposed in `tailwind.config.ts`.

## Auth

Clerk powers sign-in / sign-up. Copy `.env.example` to `.env.local` and add your
Clerk keys from the dashboard. Protected app routes live under `/dashboard`.
After first sign-up, users complete `/onboarding` (agency name + team size).
The pricing `?plan=` value is stored on the Clerk user as `unsafeMetadata.intendedPlan`
(and mirrored in a `dw_intended_plan` cookie) for the billing step later.

## Develop

```bash
npm run dev
```
