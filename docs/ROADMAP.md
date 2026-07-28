# Roadmap

Builds toward [`ARCHITECTURE.md`](./ARCHITECTURE.md) with one structural decision superimposed on the v2 plan:

> **Phase 0 and Phase 1 are merged.** The dashboard is shipped in lockstep with each foundational piece, not as a sequenced follow-up. The single user-visible deliverable for the merged sprint is **"push to a GitHub branch → app builds and deploys live, blue/green, with a one-click rollback."**

See [`docs/ACCELERATION.md`](./ACCELERATION.md) for the discussion that led here (issue planning discussion, July 2026).

---

## What changed from the prior roadmap

- Removed the Phase 0 → Phase 1 wall. Phase 0's foundational issues (#34–#37) still need to land first, but the dashboard UI lands **on top of each** rather than as a Phase 1 batch.
- Blue/green deployment (issues #50–#52) pulled **into** the MVP, not deferred. Reason: it's the zero-downtime update mechanism that makes push-CD safe enough to ship.
- Backups (#53–#58) moved to the `Deferred — Backups & Future` milestone. Valid work, not blocking the demo we want.
- A new set of issues (#59–#66) wires GitHub App installation, webhook receiver, push-deploy orchestrator, and dashboard views — the "deploy by push" feature the user actually wants.

---

## Sprint A — Close v2 Phase 0 (~1 week, hard stop)

Goal: deploy a Compose app via raw API call and see it running, with the node monitor pushing live stats/events.

| Issue | Why |
|---|---|
| #34 Forced-command script + node setup artifacts | Node-side dispatcher; Traefik file-provider directory created here |
| #35 DB schema: registered_nodes, node_events, registration_tokens | Storage for everything downstream |
| #36 Telemetry ingest endpoint | Receiver for the node monitor |
| #37 Node registration flow (SSH key + bearer token) | Provisions node identity |
| #39 Mark NodeAgentClient as @deprecated | Quick chore, fold in with the above |
| #40 Wire E2E v2 finish line | Closes this sprint |

No AI, no dashboard polish — that's Sprint B. If anything else tries to enter this sprint, move it.

---

## Sprint B — Dashboard CD MVP with blue/green (~2.5–3 weeks)

Goal: `git push` to a tracked branch on GitHub → app builds and deploys live in the node, traffic flips <1s to the new color, previous color kept warm, one-click rollback restores the previous SHA instantly.

### Chain of work (file in this dependency order)

```
#47 kind  ──┬──> #49 volume retention
            ├──> #50 compose-gen two-service  ──> #51 forced-command color actions + FSM  ──> #52 instant rollback
            └──> #59 git_sources (also driven by #50's `active_color`)
                          │
                          v
            #60 github_apps + Settings App entry
                          │
                          v
            #61 /api/github/callback + JWT helper
                          │
                          v
            #62 /api/github/events webhook receiver + recent pushes feed
                          │
                          v
            #63 Traefik dynamic-config writer (atomic SFTP)
                          │
                          v
            #64 Push deploy orchestrator (build → compose → SFTP → deploy-color → flip → warm)
                          │
                          v
            #65 Dashboard wizard "New App → GitHub"  •  #66 Rollback button
```

### Each issue, what it visibly delivers

- **#47** ships the `kind: enum["stateless","stateful","database"]` migration.
- **#49** ships "delete behavior varies by kind" audit-logged.
- **#50** ships the two-service Compose output for stateless apps (no Traefik labels — that's #63).
- **#51** ships the new forced-command actions (`deploy-color`, `stop-color`, `color-status`), the FSM extension, and unit tests.
- **#52** ships the warm-color retention reaper and instant-rollback use case (no UI yet — #66 wires the button).
- **#59** ships the `git_sources` table **and** the dashboard "Source" panel: repo, branch, short SHA, active-color pill, warm-color pill with countdown. This is the first user-facing visible sign of the whole feature — it ships before the wizard because data needs to exist before the wizard can create it.
- **#60** ships the encrypted `github_apps` table + Settings "Connect GitHub App" form (manual paste of PEM for MVP — no OAuth flow yet).
- **#61** ships the install callback + the GitHub JWT helper. The Settings page's "Install App on GitHub →" deep link works from here.
- **#62** ships the webhook receiver: verified signature, debounced+deduped, enqueues a deploy job. Adds the "Recent pushes" feed to the app detail page.
- **#63** ships the Traefik dynamic-config writer + atomic SFTP. This is the sub-second zero-downtime flip mechanism.
- **#64** ships the orchestrator — wires #48 (build), #50 (compose-gen), #51 (deploy-color), #63 (Traefik flip), #52 (warm retention). The first end-to-end push deploy works from this issue closing. Notifies via `node_events`.
- **#65** ships the wizard UI: install App → pick repo+branch → plan preview → confirm → first blue-only deploy. The cumulative user-facing entry point.
- **#66** ships the rollback button — instant Traefik file flip for `stateless` with a warm color, classical re-upload for `stateful`/`database`. The user-visible safety net for every bad push.

### What's still NOT in this sprint

- AI chat (moved to the post-MVP `Phase 2 - AI Agent Layer v1` milestone, unchanged)
- Custom domains / Let's Encrypt (nip.io subdomains only for MVP)
- Manual env-var editing UI after creation (env vars set wizard-time only)
- PR / preview deploys, multi-branch tracking
- GitHub App OAuth-based registration (manual paste only — the deep link works, but registration is human-pasted on the Settings page)
- Backups (#53–#58) — Deferred milestone

### Open risk flags — revisit weekly

- **PEM size + cipher** — #60 begins by confirming the env-vars cipher handles multi-KB blobs.
- **Traefik file-provider poll latency** — #34's node-setup snippet must set `watch=true` (default on `file` directory provider). Verify on race-detection during Sprint B.
- **Concurrent push during in-flight deploy** — #62 drops duplicates; the next push after completion catches everything. Document loudly if it diverges from expected.
- **Build OOM on small VPSes** — compose-gen output should set `--memory` per service; surface failures via `node_events` (already wired).
- **No queue durability across control-plane restarts** — a queued push is lost on crash. Acceptable for MVP (the next push resolves). Reconsider before any production claim.

---

## After the CD MVP

- Phase 2 — AI Agent Layer v1: chat UI, planner, diagnose-first. Self-healing (#52's trail of `node_events` becomes the agent's input).
- Phase 3 — Self-Healing & Proactive Agent (materially de-risked Phase 3 stays the same).
- Phase 4 — Scale Out (unchanged).
- Backups (#53–#58) — re-prioritize after CD MVP ships.