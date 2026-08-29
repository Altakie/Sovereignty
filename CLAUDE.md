# CLAUDE.md

## General Rules

- Trust code over comments
- Keep code conventions, if there is a similar code pattern that you will be creating, follow the existing way it is done in the codebase
- Reuse code as much as possible. This doesn't mean make everything into a reusable function, but if you are the same exact code in two places, extract it into a function. Also check if there are existing types or functions that do what you are trying to do.

## Comments

- Do not add comments that explain what a piece of code does or why a design choice was made (e.g. "this mirrors X", "this is intentional because Y", "wire shape of Z"). If code seems to need this kind of explanation, the code itself is too complicated — restructure or rename it instead of documenting around the confusion.
