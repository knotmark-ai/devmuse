# Security Review Checklist

## Phase 1: Architecture Mental Model
- Identify tech stack (framework, DB, auth provider, hosting)
- Map data flow: user input → processing → storage → output
- Identify trust boundaries (authenticated vs unauthenticated, internal vs external)

## Phase 2: Attack Surface Census
- List all unauthenticated endpoints
- List file upload handlers
- List webhook/callback receivers
- List background jobs that process external data
- List admin/management interfaces

## Phase 3: Secrets Archaeology
- Scan diff for hardcoded credentials (API keys, passwords, tokens)
- Check .env file patterns (committed? in .gitignore?)
- Check CI config for inline secrets vs secret manager references

## Phase 4: Dependency Supply Chain
- Check for known vulnerabilities (npm audit / pip audit / go vuln)
- Check for abandoned packages (last publish > 2 years)
- Check install scripts for suspicious behavior

## Phase 5: CI/CD Pipeline
- Check for unpinned GitHub Actions (uses: org/action@main vs @sha)
- Check for script injection via ${{ github.event.* }}
- Check for pull_request_target with checkout of PR code

## Severity Guide
- **CRITICAL:** Exploitable now, data loss/breach possible
- **HIGH:** Exploitable with effort, significant impact
- **MEDIUM:** Requires specific conditions, moderate impact
- **LOW:** Theoretical risk, minimal impact
