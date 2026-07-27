# Acceleration plan (July 2026)

Discussion that led to the current [`ROADMAP.md`](./ROADMAP.md) — recorded here so the reasoning survives the next time the plan gets challenged.

## Problem statement

The pre-acceleration roadmap sequenced Phase 0 (infra) → Phase 1 (manual dashboard) → Phase 2 (AI agent), with blue/green (#50–#52), backups (#53–#58), and self-healing all deferred to later phases. After ~3 weeks of work, the open issue list showed Phase 0 still incomplete (#34–#37, #40) and a wide range of Phase 3-issue-scope possibilities (#47–#58) sitting open and competing for attention.

Specifically:
- Phase 0 still had 5 open issues 3 weeks in.
- Phase 1 dashboard hadn't started.
- Phase 1 dashboard was scoped to wait until after Phase 0 finished — meaning a long period of user-invisible foundational work.
- Blue/green + backups were tracked alongside Phase 0 in the open list, blurring sprint boundaries.
- The actual thing the project was being built toward — **"push to GitHub → app runs, live"** — was slotted for Phase 2 (AI agent) only, despite being possible without AI.

## Decision

Merge Phase 0 and Phase 1 into a single ~3-4 week sprint (`Phase 1 - Manual MVP Dashboard` milestone, renamed conceptually to `dashboard-cd-mvp`). Move backups to a `Deferred` milestone. Pull blue/green **into** the MVP because it's the mechanism that makes push-CD safely shippable (every push = rebuild inactive color, verify, flip, keep previous warm). Keep AI agent rolled behind unchanged.

## Three concrete choices locked

| Question | Choice | Why |
|---|---|---|
| Traefik blue/green flip mechanism | File provider, dynamic config | Sub-second atomic reload, true zero-downtime. Compose labels would require a `deploy-color` recreate cycle. |
| First push deploy behavior | Blue-only, route 100% to blue | Simpler; green gets introduced by the second push. No pre-warming of an unconfigured user's image. |
| Repo build contract for MVP | `Dockerfile` at repo root | Strictest letter beats fastest to validate. Multi-service inference, configurable build paths, and compose-trust-all each add ~1-2 days of edge cases that don't help the demo. |
| GitHub App installation vector | Manual App credential paste in Settings + GitHub's "Install on GitHub →" deep link | Avoids us building OAuth-to-user flows. The deep link itself is GitHub-hosted, so the UX-after-paste is reasonable. |
| Webhook landing | GitHub App webhook to control plane directly | Standard and matches the App install path. No GitHub Actions workaround, no per-repo setup. |

## What got cut to ship in this timeline

- AI chat (Phase 2 unchanged scope, deferred after MVP)
- Custom domains + Let's Encrypt (nip.io subdomains acceptable for MVP demo)
- Manual env-var editing UI (wizard-time-only)
- PR / preview deploys
- Backups (#53–#58) — moved to `Deferred` milestone, not lost
- GitHub App registration via OAuth (manual paste only)
- Multi-server / NAT traversal (Phase 4 open question, unchanged)

## Milestone layout after replan

```
v2-phase0-finish (Sprint A)  →  dashboard-cd-mvp (Sprint B: issues #47-52, #59-66)  →  Phase 2 (AI) later
                                       \  backups #53-58 → Deferred milestone
```

## The 8 new issues filed

| # | Title | Why it's in the milestone |
|---|---|---|
| #59 | `git_sources` table + dashboard Source indicator | First user-visible artifact of the wiring; ship ahead of wizard |
| #60 | `github_apps` table + Settings "Connect GitHub App" | Trust root for CD; needs encrypted PEM storage validation first |
| #61 | `/api/github/callback` install flow + JWT helper | GitHub App installation lifecycle completed here |
| #62 | `/api/github/events` webhook receiver + recent pushes feed | Continuous deployment trigger, plus user-visible "you pushed X minutes ago" |
| #63 | Traefik file-provider dynamic-config writer | The zero-downtime flip mechanism; rewritten target state, atomic SFTP |
| #64 | Push deploy orchestrator | End-to-end push → build → flip → warm; user sees "deploying…" progress |
| #65 | Dashboard wizard "New App → GitHub" | Actual entry point: install → pick repo+branch → plan → first blue deploy |
| #66 | Rollback button | User-visible safety net via #52; instant for stateless, classical for stateful |

## Manual validation criteria before closing the milestone

- New app via wizard → repo with root Dockerfile → first blue deploy succeeds
- Second `git push` → green built, traffic flips to green < 1s, blue kept warm
- Eighth `git push` (broken image) → push fails to build; deploy aborts; live color unchanged
- Ninth push (still broken → still fails — restores via #66) OR roll back via dashboard click → traffic back to previous SHA < 1s, broken image stopped but warm
- Telemetry dashboard shows the flip events in `node_events` with monotonic seq

If the roll forward→rollback round-trip is sub-second and zero-downtime the milestone is done.