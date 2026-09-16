# CLAUDE.md

Project-level instructions. Read `CONVENTIONS.md` (Django/React) and
`CONVENTIONS-NODE.md` (`backend-node/`) for the full rules — this file
holds only what is easiest to get wrong.

## Comments

Match the comment density of the file you are editing. Do not exceed it.

Write a comment only when it says something the code cannot:

- **Why**, not what. A comment restating the line below it is noise.
- A non-obvious constraint: a verified external fact, a framework
  behaviour that contradicts what the code appears to do, a deliberate
  deviation from an obvious alternative.
- A reference that saves a reader a search: a spec section, a `CONVENTIONS.md`
  paragraph, a story or bug id.

Do not write:

- Section banners (`// ---- helpers ----`), or a comment above every block.
- JSDoc that only repeats the signature's types and parameter names.
- Narration of the change or the conversation (`// Added per request`,
  `// NOTE: this now handles X`). Git history records that; the code should
  read as if it had always been this way.
- Restatements of a rule already written in `CONVENTIONS.md` — link it instead.

A dense block of comments is appropriate in one case: a value or algorithm
verified against a live system, where the verification is the point
(`django-hasher.ts`'s hash format is the model). Everywhere else, prefer
a clearer name or a smaller function over an explanatory comment.
