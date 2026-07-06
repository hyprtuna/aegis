# Red Flags and Rationalizations

On-demand reference: the catch-yourself red-flag table and the excuse-vs-reality rationalization table. Parent `SKILL.md` covers the cycle, anti-patterns, and the workflow checklist.

## Red Flags — Stop If You Catch Yourself:

| Red Flag | What It Really Means |
|---|---|
| Writing code before the test | You are guessing at requirements |
| Writing the test after the implementation | You are writing a rubber-stamp, not a specification |
| Test passes immediately on first run | Your test does not test anything |
| "I'll add tests later" | You will not. And the code will be harder to test. |
| "This is too simple to test" | Simple code has simple tests. Write them. |
| "I need to refactor before I can test" | Refactor under existing tests, then write the new test |
| "I'll just write a few tests at once" | You are batching, not doing TDD |
| Mocking everything | You are testing your mocks, not your code |

## Rationalization Table

| The Excuse | The Reality |
|---|---|
| "I know what the code should look like" | Then the test will be trivial to write. Write it. |
| "Writing tests slows me down" | Debugging without tests slows you down more. You just don't track that time. |
| "This is just a prototype" | Prototypes become production code. The test stays. |
| "The test would be trivial" | Trivial tests catch trivial bugs. Those are the ones that ship to production. |
| "I need to explore the design first" | Write a spike (throwaway code). Then start over with TDD. Do not retrofit tests onto a spike. |
| "Tests are for QA" | Tests are a design tool. They force you to think about interfaces before implementations. |
| "I'll refactor to make it testable later" | Code written without tests is hard to test by construction. Write the test first and the code is testable by definition. |
| "This is just a config change" | Config changes break production too. Test the behavior the config controls. |
