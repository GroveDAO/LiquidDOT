# Contributing to LiquidDOT

Thank you for contributing to LiquidDOT! This guide is for the hackathon team (March 1–20, 2026).

## Daily Commit Guidelines

To maintain a meaningful commit history during the hackathon period, please follow these conventions:

### Commit Message Format

```
<type>(<scope>): <subject>
```

**Types:**
- `feat`: New feature or contract
- `fix`: Bug fix
- `test`: Adding or fixing tests
- `docs`: Documentation changes
- `refactor`: Code refactoring without behavior change
- `chore`: Build/tooling changes

**Scopes:** `vault`, `governance`, `periphery`, `mocks`, `frontend`, `scripts`, `tests`, `docs`

### Examples

```
feat(vault): implement compoundRewards with KEEPER_ROLE guard
feat(governance): add ValidatorGovernor with target validation
fix(vault): correct decimal offset for DOT/stDOT conversion
test(vault): add claimWithdrawal integration tests
docs(readme): add deployment instructions for testnet
chore(deps): upgrade OZ contracts to 5.0.2
```

## Daily Commit Checklist

Each team member should commit at minimum once per day with:
1. The feature/fix implemented that day
2. Corresponding tests (if applicable)
3. Updated documentation (if applicable)

## Branch Strategy

- `main` — Production-ready code only
- `copilot/create-liquidstaking-protocol-again` — Active development branch
- Feature branches: `feat/<feature-name>` merged via PR

## Code Style

- Solidity: NatSpec on every public function, `^0.8.26` pragma
- TypeScript: Strict mode, no `any`
- Frontend: Tailwind CSS only, functional components

## Testing Requirements

- All new contract functions must have unit tests
- Integration test coverage must remain >90% for core contracts
- Run `npm test` before every PR merge

## Submission Checklist (March 20, 2026)

- [ ] All contracts compile with zero errors
- [ ] All tests pass (`npm test`)
- [ ] Coverage >90% on core contracts
- [ ] README is complete and renders correctly on GitHub
- [ ] On-chain wallet identity set via Polkassembly
- [ ] Deployed to Polkadot Hub Testnet
- [ ] Frontend accessible and functional
