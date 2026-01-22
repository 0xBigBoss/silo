# Profiles

Profiles let you override base `silo.toml` config for different environments
(testnet, staging, local variants) without duplicating the whole file.

You can print this document with:

```
silo doc profiles
```

## Profile Basics

Declare profiles under `[profiles.<name>]` sections. Profiles can override:

- `ports`
- `hosts`
- `urls`
- `k3d` settings
- `hooks`

Example:

```toml
[profiles.testnet]
urls.API_URL = "https://api.testnet.example.com"
urls.WEB_URL = "https://web.testnet.example.com"
k3d.enabled = false
```

Profiles can also introduce new keys that do not exist in the base config.

## Merge Semantics

Profiles are merged with the base config using these rules:

- Scalar values: profile replaces base
- Objects (`ports`, `hosts`, `urls`): shallow merge, profile keys override base keys
- Arrays (`hooks`, `k3d.args`): profile replaces base array
- `[profiles.<name>.append]` arrays: appended after the base array

### Append Example

```toml
[hooks]
post-up = ["./scripts/seed-db.sh"]

[profiles.testnet]
urls.API_URL = "https://api.testnet.example.com"

[profiles.testnet.append]
hooks.post-up = ["./scripts/testnet-setup.sh"]
```

Result:
- `hooks.post-up` runs `seed-db.sh`, then `testnet-setup.sh`

## Profile Resolution Order

When determining which profile to use:

1. `--profile` flag (highest priority)
2. `SILO_PROFILE` env var
3. Lockfile profile (from a previous run)
4. No profile (use base config)

## Switching Profiles

Switching profiles for an existing instance requires `--force` to prevent
accidental changes to ports, URLs, k3d settings, or hooks:

```bash
silo up --profile testnet
silo up --profile devnet   # Error: requires --force
silo up --profile devnet --force
```

## Notes

- Unknown profiles are errors.
- Using `--profile` when `[profiles]` is missing is an error.
- Profile-specific ports still follow normal allocation rules (defaults first,
  then ephemeral if occupied, or `random`/`0` to always use ephemeral).
