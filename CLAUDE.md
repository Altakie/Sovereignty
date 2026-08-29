# CLAUDE.md

## General Rules

- Trust code over comments
- Keep code conventions, if there is a similar code pattern that you will be creating, follow the existing way it is done in the codebase
- Reuse code as much as possible. This doesn't mean make everything into a reusable function, but if you have the same exact code in two places, extract it into a function. Also check if there are existing types or functions that do what you are trying to do.

## Comments

- Write a comment only when the WHY is genuinely non-obvious — a hidden constraint, a subtle invariant, a workaround for a specific bug. Skip comments that just restate what the code does or spell out a design choice that's already clear from reading it. If code seems to need that kind of restating, the code itself is too complicated — restructure or rename it instead of documenting around the confusion.
