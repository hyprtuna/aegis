---
name: java-security
description: Use when editing Java code — PreparedStatement, BCrypt/Argon2 for passwords, MessageDigest.isEqual for tokens, validate at boundary, no Runtime.exec.
---

# Java Security

**Announce:** I'm using the `develop` skill's `languages/java/rules/security.md` overlay to inject Java security guidance for this edit.

## Status

Ready to apply.

## Rules

- **`PreparedStatement` always** — never `Statement.execute(String)` with concatenated user input. Bind parameters; let the driver escape.
- **Passwords: BCrypt or Argon2** — never `MessageDigest.SHA-256` for password storage. Use Spring Security's `PasswordEncoder` or `org.springframework.security.crypto.bcrypt`.
- **`MessageDigest.isEqual` for byte-array compares** — constant-time; prevents timing attacks on tokens/HMACs. Never `Arrays.equals` for secrets.
- **`SecureRandom` for cryptographic randomness** — never `Math.random()` or `new Random()` for tokens, IDs, or salts.
- **Validate at deserialization boundary** — bean validation (`@Valid`, `@NotNull`, `@Size`) on every controller input; never accept raw JSON into domain types.
- **Avoid `Runtime.exec(String)`** — use `ProcessBuilder` with `List<String>` args; never shell-format command strings.
- **No `XMLDecoder` / `ObjectInputStream` on untrusted data** — both deserialize to gadget chains; use JSON or a schema-validated format.
- **Secrets from env or vault** — never literals; never log secret values (mask with `***`).

## Why

`PreparedStatement` mechanizes SQL escaping; string concatenation is the canonical injection vector. `MessageDigest` for passwords is fast and rainbow-table-friendly — exactly wrong. `SecureRandom` is CSPRNG; `Random` is predictable. Java deserialization of attacker-controlled bytes is one of the most-exploited classes of vulnerability in the JVM ecosystem.

## Done — status: DONE
