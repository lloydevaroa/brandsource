# BrandSource

- `README.md` starts with a plain-English "Project status (owner view)" section that the owner (Joe) reads through his own Claude. Keep it current: in the same commit as any meaningful change, update "Now", "Next / due", "What has happened" (newest first, grouped by week) and the "Last updated" date.
- Write it for a non-coder. No secrets, keys or passwords anywhere in the repo.
- If Joe asks to log a to-do, request, bug or question, append it to the "Inbox" section of `JOE-TODO.md` using the format in that file, then commit and push only that file. Never edit the README status section on Joe's behalf; Lloyd triages the inbox and updates the README.
- Commit and push changes straight away; the live Vercel deploy is what gets checked.
