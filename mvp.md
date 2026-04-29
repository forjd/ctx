# MVP Spec: `ctx` - Local Context Packs for Coding Agents

## 1. Purpose

Build an MVP of `ctx`: a local-first CLI that helps coding agents understand a repository before editing code.

The MVP should prove one core claim:

> Given a natural-language coding task, `ctx` can produce a concise, high-signal context pack containing the files, tests, rules, risks, and project information an agent should inspect before making changes.

This is not a coding agent. It is a context engine that agents can call from the terminal.

## 2. Product Summary

`ctx` is a CLI tool for developer repositories.

It should:

- detect the project type
- index important files
- infer basic project conventions
- generate task-specific context packs
- recommend relevant tests
- inspect the current Git diff for risk signals
- write a clean handoff summary after an agent run
- output both human-readable Markdown and machine-readable JSON

The first MVP should focus on Laravel, Vue, TypeScript, JavaScript, PHP, and general Git repositories.

## 3. Non-Goals

Do not build these in the MVP:

- a chat interface
- a full coding agent
- a desktop app
- hosted sync
- user accounts
- billing
- vector database search
- embeddings
- deep AST parsing
- full static analysis
- multi-repo dashboards
- automatic memory learning
- a complex plugin system

The MVP should be deterministic, local, fast, and easy for agents to call.

## 4. Tech Stack and Implementation Bias

Use:

- Bun for runtime and package management
- TypeScript for source code
- Bun's native APIs where they are good enough:
  - `bun:sqlite` for local index storage
  - `Bun.Glob` and `node:fs` for file discovery
  - `Bun.$` for shelling out to Git, ripgrep, and framework commands
  - `Bun.file`, `Bun.write`, and Web Crypto APIs for file IO and hashing
- `oxlint` for linting
- `oxfmt` for formatting
- Husky for Git hooks
- Conventional Commits for commit discipline

Only add third-party runtime dependencies when they clearly reduce complexity:

- `commander` or `cac` is acceptable if hand-written command parsing becomes noisy.
- `zod` is acceptable for JSON/config/schema validation.
- Avoid `better-sqlite3`, `execa`, and `fast-glob` unless Bun's native APIs are insufficient.
- Avoid terminal colour dependencies for the MVP unless output readability genuinely needs them.

Prefer simple deterministic heuristics over AI calls. The MVP should have a small dependency surface and should be easy to inspect.

## 5. Repository Setup Requirements

The generated project should include:

```txt
ctx/
  src/
    cli/
      index.ts
      commands/
        init.ts
        index.ts
        map.ts
        pack.ts
        tests-for.ts
        diff-risk.ts
        handoff.ts
        rules.ts
    core/
      config.ts
      db.ts
      project.ts
      scanner.ts
      scorer.ts
      context-pack.ts
      git.ts
      output.ts
    frameworks/
      laravel/
        detect.ts
        scan.ts
        rules.ts
        tests.ts
        risks.ts
      node/
        detect.ts
        scan.ts
      vue/
        detect.ts
        scan.ts
    types/
      index.ts
  tests/
  package.json
  tsconfig.json
  oxlint.json
  .oxfmt.json
  .husky/
  commitlint.config.js
  README.md
  mvp.md
```

The CLI binary should be exposed as:

```bash
ctx
```

During local development it should be runnable with:

```bash
bun run ctx
```

## 6. Required Package Scripts

Add scripts similar to:

```json
{
  "scripts": {
    "ctx": "bun run src/cli/index.ts",
    "dev": "bun run src/cli/index.ts",
    "lint": "oxlint .",
    "format": "oxfmt --write .",
    "format:check": "oxfmt --check .",
    "typecheck": "tsc --noEmit",
    "test": "bun test",
    "check": "bun run typecheck && bun run lint && bun run format:check && bun test",
    "prepare": "husky"
  }
}
```

Install Husky hooks for:

```bash
bun run check
```

on pre-commit.

Use commitlint with Conventional Commits on commit-msg.

Examples of valid commits:

```txt
feat: add context pack command
fix: improve Laravel test discovery
chore: configure oxlint and oxfmt
```

## 7. CLI Commands

The MVP must implement the following commands.

### 7.1 `ctx init`

Initialises `.ctx/` in the current repository.

Command:

```bash
ctx init
```

Expected behaviour:

- create `.ctx/`
- create `.ctx/ctx.sqlite`
- create `.ctx/handoffs/`
- create `.ctx/packs/`
- create `.ctx/config.json`
- detect project type if possible
- print a short success message

Example output:

```txt
ctx initialised.
Project type: Laravel, Node, Vue
Index database: .ctx/ctx.sqlite
Next: run ctx index
```

### 7.2 `ctx index`

Indexes the current repository.

Command:

```bash
ctx index
```

Expected behaviour:

- ignore `vendor`, `node_modules`, `.git`, `.ctx`, `storage`, `dist`, `build`, `.next`, `coverage`
- scan important files
- store indexed file metadata in SQLite
- detect framework features
- infer basic rules
- map likely test files

The command should record:

- file path
- extension
- language
- file size
- content hash
- last modified time
- coarse category
- detected symbols where easy
- whether file is probably a test
- whether file is probably generated

Example categories:

```txt
model
controller
service
action
job
notification
policy
request
resource
migration
factory
test
route
config
frontend-page
frontend-component
unknown
```

### 7.3 `ctx map`

Prints a project summary.

Command:

```bash
ctx map
```

Expected Markdown/text output:

```txt
Project Map

Detected stack:
- Laravel
- Vue
- TypeScript
- Pest

Important directories:
- app/Models
- app/Http/Controllers
- app/Services
- app/Jobs
- app/Notifications
- database/migrations
- tests/Feature
- resources/js

Detected conventions:
- Uses Pest tests
- Uses Vue frontend
- Uses Laravel migrations
- Uses queued jobs
```

Also support:

```bash
ctx map --json
```

### 7.4 `ctx pack <task>`

Generates a task-specific context pack.

Command:

```bash
ctx pack "add expiry reminders for source-of-funds requests"
```

Required output sections:

```txt
Context Pack

Task
Relevant files
Relevant tests
Project rules
Relevant Git history
Risk notes
Suggested commands
Next actions
```

Also support:

```bash
ctx pack "task" --json
ctx pack "task" --markdown
ctx pack "task" --output .ctx/packs/my-task.md
```

The default output should be human-readable Markdown printed to stdout.

#### File ranking rules

Implement a simple scoring system. Candidate files should gain points for:

- task keyword appears in file path
- task keyword appears in file content
- exact or partial class/entity name match
- framework category relevance
- likely related test file
- recent Git changes mentioning task terms
- file imported by or importing a high-ranking file
- inferred project rules reference the file or category

Candidate files should lose points for:

- very large files
- generated files
- vendor or dependency files
- build artefacts
- lock files unless dependency-related task

Each returned file must include a reason.

Good output:

```txt
- app/Models/SourceOfFundsRequest.php
  Reason: filename matches source-of-funds concept and contains expiry-related fields.
```

Bad output:

```txt
- app/Models/SourceOfFundsRequest.php
```

#### Minimum expected context pack quality

For a Laravel task involving a model/entity, the pack should try to include:

- model
- migration
- controller or action
- service class
- form request
- policy if present
- notification/job if task mentions reminders, queues, or emails
- feature/unit tests
- related frontend page/component if present

### 7.5 `ctx tests-for`

Recommends test commands.

Commands:

```bash
ctx tests-for app/Services/AmlRiskService.php
ctx tests-for --changed
```

Expected behaviour:

- find tests by filename similarity
- find tests importing or referencing target symbols
- find tests with matching domain keywords
- inspect Git changed files when using `--changed`
- return recommended commands

Example output:

```txt
Recommended tests

Direct:
- php artisan test tests/Unit/AmlRiskServiceTest.php

Broader:
- php artisan test --filter=AmlRisk

Reasoning:
- Direct filename match
- Test references AmlRiskService
- Changed file is in app/Services
```

For Node/Vue projects, suggest appropriate commands from `package.json` where possible.

Examples:

```bash
bun test
npm test
pnpm test
vitest run
```

### 7.6 `ctx diff-risk`

Analyses the current Git diff for risk signals.

Command:

```bash
ctx diff-risk
```

Expected behaviour:

- run `git diff --name-only`
- classify changed files
- apply simple risk heuristics
- report risk level: low, medium, high
- suggest checks/tests

Risk heuristics for Laravel:

High or medium risk when changed files include:

- migrations
- auth middleware
- policies
- gates
- payment or money handling
- queue jobs
- notifications
- API resources
- validation requests
- enums used in `match` expressions
- config files
- environment-related files
- database casts

Also flag:

- migration changed but no test changed
- request validation changed but no feature test changed
- enum changed but no tests changed
- job changed without retry/backoff indicators
- notification changed with possible sensitive data terms
- money-related file changed

Example output:

```txt
Diff Risk Report

Risk level: Medium

Changed areas:
- Migration
- Queue job
- Notification

Concerns:
- Migration changed but no matching feature test changed.
- Queue job changed; check tries/backoff behaviour.
- Notification changed; verify no sensitive financial data is included.

Suggested checks:
- php artisan test --filter=SourceOfFunds
- php artisan migrate:fresh --seed
```

Also support:

```bash
ctx diff-risk --json
```

### 7.7 `ctx rules`

Prints inferred project rules.

Command:

```bash
ctx rules
```

Rules should be inferred from:

- `composer.json`
- `package.json`
- `pest.php`
- `phpunit.xml`
- `pint.json`
- `eslint.config.*`
- `AGENTS.md`
- `CLAUDE.md`
- `.cursor/rules/*`
- `README.md`
- `docs/*`

Example output:

```txt
Project Rules

- Use Pest for PHP tests.
- Use Laravel migrations for schema changes.
- Use Vue components under resources/js.
- Do not edit generated files.
- Run php artisan test for backend changes.
```

### 7.8 `ctx handoff`

Creates a handoff summary of the current work.

Command:

```bash
ctx handoff
```

Expected behaviour:

- inspect current Git branch
- inspect changed files
- inspect staged files
- inspect recent commits on current branch
- generate a Markdown handoff in `.ctx/handoffs/`

Example output file:

```txt
.ctx/handoffs/2026-04-29-source-of-funds-expiry.md
```

Example content:

```md
# Agent Handoff

## Branch

feature/source-of-funds-expiry

## Changed files

- app/Jobs/SendSourceOfFundsReminderJob.php
- tests/Feature/SourceOfFundsReminderTest.php

## Summary

This branch appears to add expiry reminder behaviour for source-of-funds requests.

## Tests to run

- php artisan test --filter=SourceOfFunds

## Open risks

- Confirm reminder timing with product/business owner.
- Check that completed requests do not receive reminders.
```

Also support:

```bash
ctx handoff --stdout
ctx handoff --json
```

## 8. SQLite Schema

Implement a minimal SQLite schema using `bun:sqlite`.

Suggested tables:

```sql
create table if not exists files (
  id integer primary key autoincrement,
  path text not null unique,
  extension text,
  language text,
  category text,
  size_bytes integer,
  hash text,
  is_test integer not null default 0,
  is_generated integer not null default 0,
  indexed_at text not null
);

create table if not exists symbols (
  id integer primary key autoincrement,
  file_id integer not null,
  name text not null,
  kind text,
  line_start integer,
  line_end integer,
  foreign key (file_id) references files(id)
);

create table if not exists rules (
  id integer primary key autoincrement,
  text text not null,
  source text,
  confidence text,
  created_at text not null
);

create table if not exists packs (
  id text primary key,
  task text not null,
  output_markdown text not null,
  output_json text not null,
  created_at text not null
);

create table if not exists handoffs (
  id text primary key,
  branch text,
  file_path text not null,
  summary text not null,
  created_at text not null
);
```

Do not over-engineer this. Add columns only when needed.

## 9. Configuration

Create `.ctx/config.json` on init.

Example:

```json
{
  "version": 1,
  "projectName": null,
  "preferredPackageManager": "bun",
  "ignoredDirectories": [
    ".git",
    ".ctx",
    "node_modules",
    "vendor",
    "storage",
    "dist",
    "build",
    "coverage"
  ],
  "frameworks": {
    "laravel": true,
    "node": true,
    "vue": true
  }
}
```

## 10. Output Requirements

Every major command should support human-readable output and JSON output.

Markdown printed to stdout is the default for commands that produce reports. JSON output should be stable enough for coding agents to parse.

Required JSON shape for `ctx pack --json`:

```json
{
  "task": "add expiry reminders for source-of-funds requests",
  "generatedAt": "2026-04-29T20:00:00.000Z",
  "project": {
    "root": "/path/to/repo",
    "frameworks": ["laravel", "vue", "typescript"]
  },
  "files": [
    {
      "path": "app/Models/SourceOfFundsRequest.php",
      "score": 82,
      "category": "model",
      "reason": "Path and content match source-of-funds terms."
    }
  ],
  "tests": [
    {
      "path": "tests/Feature/SourceOfFundsReminderTest.php",
      "command": "php artisan test tests/Feature/SourceOfFundsReminderTest.php",
      "reason": "Direct domain match."
    }
  ],
  "rules": [
    {
      "text": "Use Pest for PHP tests.",
      "source": "pest.php"
    }
  ],
  "risks": [
    {
      "level": "medium",
      "text": "Reminder logic may involve queued jobs and notifications."
    }
  ],
  "suggestedCommands": ["php artisan test --filter=SourceOfFunds"]
}
```

## 11. Heuristic Details

### 11.1 Project Detection

Detect Laravel if any of these exist:

```txt
artisan
composer.json containing laravel/framework
app/Http
routes/web.php
routes/api.php
```

Detect Vue if any of these exist:

```txt
vue in package.json dependencies
resources/js
src/**/*.vue
vite.config.ts
```

Detect TypeScript if:

```txt
tsconfig.json exists
*.ts files exist
*.tsx files exist
```

Detect Pest if:

```txt
pest.php exists
composer.json contains pestphp/pest
```

### 11.2 Laravel Category Detection

Use path-based categorisation first:

```txt
app/Models/* => model
app/Http/Controllers/* => controller
app/Http/Requests/* => request
app/Http/Resources/* => resource
app/Services/* => service
app/Actions/* => action
app/Jobs/* => job
app/Notifications/* => notification
app/Policies/* => policy
app/Enums/* => enum
database/migrations/* => migration
database/factories/* => factory
tests/Feature/* => feature-test
tests/Unit/* => unit-test
routes/* => route
config/* => config
resources/js/Pages/* => frontend-page
resources/js/Components/* => frontend-component
```

### 11.3 Symbol Extraction

Use lightweight regex extraction for MVP.

For PHP:

```txt
class SomeClass
interface SomeInterface
trait SomeTrait
enum SomeEnum
function someFunction
```

For TypeScript/Vue:

```txt
export class SomeClass
export function someFunction
const someName =
function someFunction
interface SomeInterface
type SomeType
```

This does not need to be perfect.

### 11.4 Keyword Normalisation

Normalise task terms.

Examples:

```txt
source-of-funds => source of funds, source_of_funds, SourceOfFunds, SOF
anti-money-laundering => AML, aml, anti money laundering
expiry => expires, expired, expiration, expiring
reminder => notification, notify, email, mail
```

Implement a small built-in synonym map.

Keep it editable later through config.

## 12. Testing Requirements

Add Bun tests for core behaviours.

Minimum tests:

- project detection detects Laravel from fixture
- project detection detects Vue from fixture
- scanner ignores `node_modules`, `vendor`, `.git`, `.ctx`
- scanner categorises Laravel files correctly
- symbol extraction finds PHP classes and enums
- symbol extraction finds TypeScript functions/types
- pack scorer ranks path matches above unrelated files
- `tests-for` finds direct filename test matches
- `diff-risk` flags migrations as medium/high risk
- Markdown output contains required sections
- JSON output validates against schema

Use fixtures under:

```txt
tests/fixtures/laravel-basic/
tests/fixtures/node-vue-basic/
```

## 13. Acceptance Criteria

The MVP is complete when all of the following are true:

### Setup

- `bun install` works
- `bun run check` passes
- Husky pre-commit runs checks
- commitlint enforces Conventional Commits
- SQLite access uses `bun:sqlite`
- Shell commands use `Bun.$` unless a clear limitation requires another package
- File discovery uses Bun and Node filesystem APIs unless a clear limitation requires another package

### CLI

- `ctx init` creates `.ctx/`
- `ctx index` indexes a fixture or real repo
- `ctx map` prints detected stack and conventions
- `ctx pack "task"` outputs a useful Markdown context pack
- `ctx pack "task" --json` outputs valid JSON
- `ctx tests-for --changed` recommends plausible tests
- `ctx diff-risk` reports risk based on current Git diff
- `ctx rules` prints inferred rules
- `ctx handoff` writes a Markdown file to `.ctx/handoffs/`

### Behaviour

- the tool works without external AI APIs
- the tool does not read ignored directories
- the tool does not require global installation during development
- the output includes reasons for file and test recommendations
- the context pack is concise enough to paste into an agent prompt

## 14. Demo Scenario

Create or use a small Laravel-style fixture containing:

```txt
app/Models/SourceOfFundsRequest.php
app/Jobs/SendSourceOfFundsReminderJob.php
app/Notifications/SourceOfFundsReminderNotification.php
app/Http/Controllers/SourceOfFundsController.php
app/Enums/SourceOfFundsStatus.php
database/migrations/2026_01_01_000000_create_source_of_funds_requests_table.php
tests/Feature/SourceOfFundsReminderTest.php
pest.php
composer.json
package.json
resources/js/Pages/SourceOfFunds/Show.vue
```

Then run:

```bash
bun run ctx init
bun run ctx index
bun run ctx map
bun run ctx pack "add expiry reminders for source-of-funds requests"
bun run ctx tests-for --changed
bun run ctx diff-risk
bun run ctx handoff
```

The demo should prove that `ctx pack` finds the relevant model, job, notification, enum, migration, frontend page, and test file.

## 15. Suggested Implementation Order

Follow this order:

1. Create Bun + TypeScript project skeleton.
2. Configure `oxlint`, `oxfmt`, TypeScript, Husky, and commitlint.
3. Implement CLI command routing.
4. Implement `.ctx` initialisation.
5. Implement SQLite database setup with `bun:sqlite`.
6. Implement project detection.
7. Implement file scanning and categorisation.
8. Implement simple symbol extraction.
9. Implement rule inference.
10. Implement `ctx map`.
11. Implement context scoring.
12. Implement `ctx pack` Markdown output.
13. Implement `ctx pack --json`.
14. Implement test discovery.
15. Implement `ctx tests-for`.
16. Implement diff risk heuristics.
17. Implement `ctx diff-risk`.
18. Implement handoff generation.
19. Add fixtures and tests.
20. Polish README with demo commands.

## 16. Quality Bar

The implementation should prioritise:

- boring, understandable code
- deterministic output
- explicit reasons for recommendations
- clear command errors
- useful Markdown
- useful JSON
- small, composable modules
- testable pure functions where practical

Avoid cleverness. The MVP should be easy to inspect, easy to change, and useful quickly.

## 17. Example Final Output

Running:

```bash
ctx pack "add expiry reminders for source-of-funds requests"
```

Should produce something like:

```md
# Context Pack

## Task

add expiry reminders for source-of-funds requests

## Relevant files

### app/Models/SourceOfFundsRequest.php

Reason: path and content match source-of-funds terms. Likely contains expiry/status fields.

### app/Jobs/SendSourceOfFundsReminderJob.php

Reason: task mentions reminders and this is an existing reminder job.

### app/Notifications/SourceOfFundsReminderNotification.php

Reason: reminder task likely sends user-facing notifications.

### app/Enums/SourceOfFundsStatus.php

Reason: expiry behaviour may depend on request status.

### database/migrations/2026_01_01_000000_create_source_of_funds_requests_table.php

Reason: migration likely defines expiry/status columns.

## Relevant tests

- tests/Feature/SourceOfFundsReminderTest.php
  Command: php artisan test tests/Feature/SourceOfFundsReminderTest.php
  Reason: direct domain and reminder match.

## Project rules

- Use Pest for PHP tests.
- Use Laravel jobs for queued work.
- Use notifications for user-facing reminders.

## Risk notes

- Reminder logic may send duplicate notifications if idempotency is not handled.
- Expired and completed requests should probably be excluded.
- Queue retry/backoff behaviour should be explicit.

## Suggested commands

- php artisan test tests/Feature/SourceOfFundsReminderTest.php
- php artisan test --filter=SourceOfFunds

## Next actions

1. Inspect the model and existing reminder job.
2. Confirm expiry and reminder timing.
3. Add or update tests before changing behaviour.
4. Run the recommended tests.
```

## 18. Final Instruction to the Agent

Build the smallest version that proves `ctx pack` can improve coding-agent context selection.

Do not expand into a full AI platform.

Do not add external AI dependencies.

Do not build a UI.

Make the CLI useful, deterministic, inspectable, and easy to run against a Laravel/Vue repository.
