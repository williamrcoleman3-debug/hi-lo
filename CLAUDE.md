# Hi-Lo Game — Rules for Claude Code

## How we work
1. Explore. Read the code first. Don't change anything yet.
2. Plan. Write a short plan. Wait for me to approve it.
3. Code. Build it.
4. Commit. Write a clear commit message.

## Tests
- Write tests first, based on what the feature should do.
- Run them. Confirm they fail.
- Commit the failing tests.
- Write code until the tests pass. Don't edit the tests.

## Visual work
- Build it.
- Take a screenshot.
- Compare to the goal.
- Fix and repeat, two or three times.

## Hard rules
- Tokens can never be bought with real money. This is a legal term of the $25,000 contest.
- Ask before you write any prompt. Confirm what I want first.
- I'm not technical. Keep manual steps plain and few.

## Project facts
- Stack: Vite, React, Supabase, Netlify.
- Deck and outcome logic run on the server, not in the browser.
- Rate limit: 10 requests per second per user, tied to their account, not their IP.
- Daily limit: 100 games per deck per day.
- Contest ends March 31, 2027. Prize: $25,000. Win by clearing 51 hands, or by holding the top win streak if no one clears by the deadline.
