
# Contributing to QCU Student Planner

Thank you for your interest in contributing to QCU Student Planner!

QCU Student Planner is a student-developed web application designed to help students organize their academic tasks, manage their schedules, track their progress, and improve their study experience.

We welcome contributions from team members and other developers who want to help improve the project.

This document outlines the guidelines for contributing code, reporting issues, submitting changes, and collaborating with the development team.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Branching Strategy](#branching-strategy)
- [Contribution Workflow](#contribution-workflow)
- [Commit Message Guidelines](#commit-message-guidelines)
- [Code Guidelines](#code-guidelines)
- [Pull Request Guidelines](#pull-request-guidelines)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Enhancements](#suggesting-enhancements)
- [Communication and Collaboration](#communication-and-collaboration)
- [Recognition](#recognition)

## Getting Started

Before contributing, make sure you have:

- A GitHub account.
- Git installed on your machine.
- A code editor such as Visual Studio Code.
- Basic knowledge of HTML, CSS, JavaScript, and the technologies used in the project.
- Access to the project's repository and necessary development configurations.

Familiarize yourself with the existing project structure and coding conventions before making changes.

## Development Setup

1. Clone the repository:

   ```bash
   git clone https://github.com/MikeyMadeIt/qcu-student-planner.git
   ```

2. Navigate to the project directory:

   ```bash
   cd qcu-student-planner
   ```

3. Switch to the development branch:

   ```bash
   git checkout develop
   ```

4. Install the required dependencies, if applicable:

   ```bash
   npm install
   ```

5. Configure the required environment variables using the project's environment configuration instructions.

6. Start the local development environment using the appropriate project command.

**Note:** Do not commit environment files containing API keys, database credentials, access tokens, or other sensitive information.

## Branching Strategy

We follow a branch-based development workflow to keep the main codebase stable and make collaboration easier.

| Branch | Purpose |
|---|---|
| `main` | Stable and production-ready code |
| `develop` | Main integration branch for ongoing development |
| `dev/*` | Individual feature development and fixes |

### Branch Naming

Use the following conventions when creating branches:

- `dev/feature-name` for new features.
- `dev/fix-name` for bug fixes.
- `dev/ui-name` for UI/UX improvements.
- `dev/refactor-name` for code refactoring.
- `dev/docs-name` for documentation updates.

Examples:

```bash
dev/quiz-maker
dev/fix-authentication
dev/dashboard-ui
dev/refactor-task-manager
dev/update-documentation
```

Avoid working directly on `main` or `develop` unless explicitly authorized.

## Contribution Workflow

Follow these steps when contributing:

**1. Update your local repository.**

```bash
git checkout develop
git pull origin develop
```

**2. Create your working branch.**

```bash
git checkout -b dev/your-feature-name
```

**3. Make your changes.**

Implement your assigned feature, fix, or improvement. Keep changes focused on the task.

**4. Test your changes.**

Before committing, verify that:

- The feature works as expected.
- Existing functionality is not broken.
- The interface is responsive on mobile and desktop.
- There are no obvious console errors.
- Database operations and authentication work correctly when applicable.

**5. Commit your changes.**

Follow the project's commit message guidelines.

**6. Push your branch.**

```bash
git push -u origin dev/your-feature-name
```

**7. Create a Pull Request.**

Open a Pull Request on GitHub and set `develop` as the base branch.

Provide a clear description of your changes and wait for review before merging.

## Commit Message Guidelines

Use clear and descriptive commit messages.

We recommend the Conventional Commits format:

```text
type: short description
```

Common types include:

| Type | Description |
|---|---|
| `feat` | Introduces a new feature |
| `fix` | Fixes a bug |
| `ui` | Improves the user interface |
| `style` | Formatting or styling changes without logic changes |
| `refactor` | Improves code structure without changing behavior |
| `docs` | Updates documentation |
| `chore` | Maintenance and configuration changes |
| `perf` | Performance improvements |
| `test` | Adds or updates tests |

Examples:

```bash
git commit -m "feat: add task filtering"
git commit -m "fix: resolve semester sync issue"
git commit -m "ui: improve mobile dashboard layout"
git commit -m "docs: update installation guide"
```

Keep commit messages short, meaningful, and specific.

## Code Guidelines

To maintain consistency and readability across the project:

- Follow the existing project structure and naming conventions.
- Write clean, readable, and maintainable code.
- Use meaningful variable and function names.
- Avoid unnecessary code duplication.
- Keep functions and components focused on their responsibilities.
- Reuse existing components and utilities whenever possible.
- Remove unused code, debugging statements, and unnecessary comments.
- Handle errors appropriately, especially when working with authentication, database operations, and API requests.
- Avoid introducing unnecessary dependencies.
- Make sure UI changes follow the project's existing design system.

### Database and Security

When working with Supabase or other backend-related features:

- Follow existing database schemas and conventions.
- Never expose service-role keys or private credentials.
- Respect existing Row Level Security (RLS) policies.
- Do not bypass authentication or authorization checks.
- Make database changes through properly structured migrations.
- Test database changes before submitting a Pull Request.
- Avoid collecting unnecessary personal or sensitive information.

## Pull Request Guidelines

Before submitting a Pull Request, make sure your contribution is ready for review.

A Pull Request should:

- Have a clear and descriptive title.
- Explain what was changed and why.
- Reference the related issue or assigned task, if applicable.
- Include screenshots for significant UI/UX changes.
- Mention any database migrations or environment changes.
- Identify known limitations or unfinished work.
- Avoid unrelated changes in the same Pull Request.

### Pull Request Checklist

Before requesting a review, verify the following:

- [ ] My changes are related to the assigned task or issue.
- [ ] My code follows the existing project conventions.
- [ ] I have tested the affected functionality.
- [ ] I have checked the mobile and desktop layouts when applicable.
- [ ] I have not committed credentials or sensitive information.
- [ ] I have included necessary documentation or migration files.
- [ ] My branch is updated with the latest relevant changes.
- [ ] I have provided a clear Pull Request description.

Pull Requests should target `develop`, not `main`, unless otherwise instructed by the maintainers.

## Reporting Bugs

If you encounter a bug, report it through the repository's GitHub Issues.

Include the following information:

1. **Bug description:** Explain what happened.
2. **Steps to reproduce:** Provide the steps needed to reproduce the issue.
3. **Expected behavior:** Describe what should have happened.
4. **Actual behavior:** Describe what happened instead.
5. **Environment:** Include your browser, device, or relevant environment details.
6. **Screenshots:** Attach screenshots or recordings when they help explain the issue.

Before submitting a new issue, check whether the same problem has already been reported.

## Suggesting Enhancements

Suggestions for new features and improvements are welcome.

When proposing an enhancement:

- Explain the problem or limitation it addresses.
- Describe the proposed solution.
- Explain how it would benefit users.
- Include possible implementation considerations, if applicable.
- Provide references, mockups, or examples when useful.

Discuss major changes with the maintainers before beginning implementation to avoid duplicated work or conflicting approaches.

## Communication and Collaboration

Collaboration is an important part of this project.

Contributors are expected to:

- Communicate with their assigned team members.
- Keep their assigned tasks updated.
- Inform the team about blockers or implementation difficulties.
- Coordinate changes when working on shared files or components.
- Review feedback constructively.
- Avoid merging conflicting or unreviewed changes into shared branches.

If you are unsure about an implementation decision, ask before making changes that could affect other parts of the application.

## Recognition

Every meaningful contribution helps improve QCU Student Planner.

We appreciate contributions involving:

- Feature development.
- Bug fixes.
- UI/UX improvements.
- Performance optimization.
- Documentation.
- Testing and quality assurance.
- Suggestions and feedback.

Thank you for helping us build and improve QCU Student Planner!

---

**Project Note**

QCU Student Planner is an independent student-developed project. It is not an official application of Quezon City University and is not affiliated with or endorsed by the university.
