## What changed and why

<!-- The "why" matters more than the "what". If this fixes a bug, describe the
     root cause, not just the symptom. -->

## Evidence

<!-- Paste real command output. If you claim a number (faster, fewer, more
     accurate), include the method: what data, which call path, what criterion.
     See docs/OLCUM.md. -->

```
```

## Checklist

- [ ] `npm test` green
- [ ] Behaviour change → test added
- [ ] If this adds/changes a gate: tested **both** that it speaks when it should
      **and** that it stays silent when it should
- [ ] No new dependencies
- [ ] Nothing invented — if something can't be resolved, it reports that instead
      of guessing
