# CLAUDE.md

Use `AGENTS.md` as the authoritative project guide.

## Claude-Specific Notes

- Use `PLAN.md` as the current execution ledger and task boundary map.
- Preserve the three-pass render pipeline, audio flow, and shader uniform contract.
- Keep `.claude/` as the canonical shared instruction folder for rules, plans, skills, and agents.
- Treat `.codex/` as Codex-specific local configuration; do not remove it unless its unique TOML content is migrated.
- Avoid large refactors or replacement systems unless the user explicitly approves an architecture change.
