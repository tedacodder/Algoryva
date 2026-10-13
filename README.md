<p align="center">
  <a href="https://github.com/tedacodder/Algoryva">
    <img src="public/brand/algoryva-lockup.svg" alt="Algoryva" width="360">
  </a>
</p>

<p align="center">
  <strong>Learn algorithms, practice, compete.</strong><br>
  A structured path from your first <code>print()</code> to contest-ready problem solving.
</p>

<p align="center">
  <a href="#quick-start">Quick start</a> ·
  <a href="#features">Features</a> ·
  <a href="#development">Development</a> ·
  <a href="#project-structure">Project structure</a>
</p>

## About

Algoryva is a free, Python-first algorithm learning platform. Instead of presenting an unstructured list of topics, it models prerequisites as a curriculum graph so learners can see what to study next.

The learning loop is deliberately small:

1. Read a focused lesson with examples, complexity notes, and common mistakes.
2. Visualize the algorithm step by step.
3. Solve a matching original problem or continue with a curated external problem.
4. Review completed topics, record mistakes, and reinforce weak areas.
5. Try a virtual contest when you are ready.

## Features

- **Prerequisite-driven roadmap** across six levels, from Python and arrays through graphs, dynamic programming, geometry, and contest strategy.
- **Complete lessons** stored as typed content in `src/content/lessons-v2/`, with Python examples, quizzes, visual explanations, and quality checks.
- **Interactive algorithm visualizer** at `/visualizer`, including arrays, sorting, trees, graphs, dynamic programming, greedy algorithms, union-find, Fenwick trees, tries, segment trees, and backtracking.
- **Practice library** combining original internal problems with curated links to platforms such as LeetCode and Codeforces.
- **Paste-and-check problem flow** for internal problems. Public sample data is shown; hidden tests return verdicts without exposing their answers.
- **Virtual contests** with per-learner timers, solved-first scoring, penalty time, and standings.
- **Learning dashboard** with topic progress, mastery checks, streaks, XP, badges, notes, mistakes, and spaced review.
- **Authentication and administration** with email verification, password reset, sessions, roles, user management, lesson/problem/contest administration, and analytics.
- **Search and recommendations** for lessons, topics, and published problems.

> [!WARNING]
> Algoryva does **not** execute user-submitted source code on the server. The current internal-problem judge compares pasted output with expected output. A sandboxed code-execution service remains a separate, security-sensitive project.

## Quick start

### Requirements

- Node.js 22 or newer
- PostgreSQL 16 or newer
- Python 3.10 or newer for lesson-snippet and reference-solution checks

### Local setup

```bash
git clone https://github.com/tedacodder/Algoryva.git
cd Algoryva

npm install
cp .env.example .env
```

Set `DATABASE_URL` in `.env` to a PostgreSQL database, for example:

```dotenv
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/cp_platform"
SITE_URL="http://localhost:3000"
```

Create the schema, load the curriculum and practice data, then start Next.js:

```bash
npm run db:migrate
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The seed loads the curriculum, prerequisite relationships, original problems, hidden tests, and external practice links. To create the first administrator, register an account and set its `role` to `ADMIN` with Prisma Studio:

```bash
npx prisma studio
```

### Email in development

Set `RESEND_API_KEY` and `EMAIL_FROM` to send mail through Resend. If they are empty, verification and password-reset messages are printed to the server console instead.

## Development

Run the checks used by CI:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Run the browser smoke tests against a running, seeded application:

```bash
npx playwright install
npm run dev
# In another terminal:
npm run test:e2e
```

Useful commands:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm start` | Start the production server |
| `npm run db:migrate` | Apply development Prisma migrations |
| `npm run db:seed` | Seed topics, lessons, problems, and tests |
| `npx prisma studio` | Inspect the PostgreSQL database |
| `npx tsx scripts/check-links.ts` | Check external practice links for 404/410 responses |

## Docker

The repository includes a Dockerfile and a PostgreSQL-backed Compose setup:

```bash
docker compose up --build
docker compose run --rm app npx prisma migrate deploy
docker compose run --rm app npm run db:seed
```

The app is available at [http://localhost:3000](http://localhost:3000). For production deployments, put the app behind a reverse proxy and configure `TRUST_PROXY` only when that proxy overwrites `X-Forwarded-For`; see `.env.example` and the rate-limit implementation in `src/lib/rate-limit.ts`.

## Application areas

| Area | Route | Description |
| --- | --- | --- |
| Landing page | `/` | Product overview and curriculum entry point |
| Roadmap | `/roadmap` | Six-level prerequisite graph |
| Lessons | `/learn` | Browse and read the curriculum |
| Practice | `/problems` | Filter and solve internal or external problems |
| Visualizer | `/visualizer` | Run and step through algorithms with your own bounded input |
| Contests | `/contests` | Join virtual contests and view standings |
| Dashboard | `/dashboard` | Progress, recommendations, streaks, and mastery |
| Review | `/mistakes`, `/notes` | Track mistakes and personal notes |
| Profile | `/profile` | XP, badges, preferences, and account status |
| Administration | `/admin` | Manage users, lessons, problems, contests, and analytics |

## Project structure

```text
src/
├── app/                 Next.js routes, pages, server actions, and metadata
├── components/          UI, lesson rendering, visualizers, and application shell
├── content/              Curriculum lessons, problems, hidden tests, and challenges
└── lib/                  Auth, curriculum, progress, judging, contests, and algorithms
prisma/
├── schema.prisma         PostgreSQL data model
├── migrations/           Versioned database migrations
└── seed.ts               Curriculum and practice-data seeding
public/brand/             Algoryva logos and brand assets
docs/                     Architecture, curriculum, UX, and quality documentation
tests/e2e/                Playwright smoke tests
```

The main extension points are:

- Add or edit a lesson in `src/content/lessons-v2/`.
- Add an original problem in `src/content/originalProblems.ts` and its hidden cases in `src/content/hiddenTests.ts`.
- Add a visualizer algorithm in `src/lib/visualizer/`, then register it in `src/lib/visualizer/registry.ts`.
- Add a schema change with Prisma, then run the migration and seed commands above.

## Technical stack

- [Next.js](https://nextjs.org/) 15 with the App Router
- [React](https://react.dev/) 19 and TypeScript
- [Tailwind CSS](https://tailwindcss.com/)
- [Prisma](https://www.prisma.io/) with PostgreSQL
- [Vitest](https://vitest.dev/) for unit and content-quality tests
- [Playwright](https://playwright.dev/) for end-to-end smoke tests
- Self-hosted Bricolage Grotesque and JetBrains Mono fonts

## Documentation

The `docs/` directory contains deeper project documentation, including:

- `CODE_JUDGE_ARCHITECTURE.md` — current judge boundary and future sandbox considerations
- `CURRICULUM_AUDIT.md` — lesson and curriculum coverage
- `LESSON_QUALITY_STANDARD.md` — requirements enforced for complete lessons
- `UI_UX_REDESIGN_HANDOFF.md` — interface and design-system notes
- `ALGORYVA_PROJECT_AUDIT.md` — implementation and verification status
