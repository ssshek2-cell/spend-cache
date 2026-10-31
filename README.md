# spend-cache

Claude Code mod. Adds a band above the prompt:

- `$X of $100.00 spent this month`
- WARM (red, robot bobs): prompt cache is live; shows minutes left and the estimated cost of your next message.
- COLD (blue, robot frozen): cache expired after an hour; next message re-sends the whole chat, price shown first.

## Install

At the prompt of a terminal session:

```
/plugin install spend-cache --marketplace <owner>/<repo>
```

Answer `y` to add the marketplace, then pick a scope. Set the budget and input price in the mod's config.

## Sync spend

Claude Code does not expose your month total, so the mod counts spend from this machine. Sync it to the figure on claude.ai:

```
/spend-set 12.34
```

Costs shown for the next message are estimates from the input price setting.
