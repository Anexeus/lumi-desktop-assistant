// Stands in for `claude -p … --output-format stream-json` in tests. Behaviour depends on the prompt.
const args = process.argv.slice(2)
const prompt = args[args.indexOf('-p') + 1] ?? ''
const mode = args[args.indexOf('--permission-mode') + 1] ?? ''
const out = (o) => process.stdout.write(JSON.stringify(o) + '\n')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

out({ type: 'system', subtype: 'init', cwd: process.cwd(), model: 'fake-claude', permissionMode: mode })
if (prompt.includes('login')) {
  out({ type: 'result', subtype: 'success', is_error: true, result: 'Not logged in · Please run /login', permission_denials: [] })
  process.exit(1)
}
out({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Read', input: { file_path: process.cwd() + '\\README.md' } }] } })
await sleep(prompt.includes('slow') ? 10_000 : 150)
out({ type: 'assistant', message: { content: [{ type: 'text', text: `Working in ${mode} mode on: ${prompt}` }] } })
out({ type: 'result', subtype: 'success', is_error: false, result: `Done: ${prompt}`, total_cost_usd: 0.0123, num_turns: 2, permission_denials: [{ tool_name: 'Edit' }] })
