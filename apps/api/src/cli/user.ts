import { createInterface } from 'node:readline';
import { parseArgs } from 'node:util';

import { AccountError, createAccount, resetPassword, upsertAccount } from './accounts';
import { runWithAuthContext } from './bootstrap';

const USAGE = `Manage accounts without email (ADR-0018).

  pnpm user:create --email <email> --name <name>
  pnpm user:reset-password --email <email>

Options:
  --password-stdin   read the password from stdin instead of prompting
  --upsert           (create) reset the password if the account already exists
`;

/** Prompts without echoing what is typed. */
function promptHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    process.stdout.write(question);
    // readline echoes keystrokes through this hook; silence it for passwords.
    (rl as unknown as { _writeToOutput: (text: string) => void })._writeToOutput = () => {};
    rl.question('', (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

async function readPassword(fromStdin: boolean): Promise<string> {
  if (fromStdin || !process.stdin.isTTY) {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
    return Buffer.concat(chunks)
      .toString('utf8')
      .replace(/\r?\n$/, '');
  }
  const password = await promptHidden('Password: ');
  if ((await promptHidden('Repeat password: ')) !== password) {
    throw new AccountError('Passwords do not match.');
  }
  return password;
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    // pnpm may forward a literal `--` separator.
    args: process.argv.slice(2).filter((arg) => arg !== '--'),
    allowPositionals: true,
    options: {
      email: { type: 'string' },
      name: { type: 'string' },
      'password-stdin': { type: 'boolean', default: false },
      upsert: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  const [command] = positionals;
  const { email, name } = values;

  if (values.help || !command) {
    process.stdout.write(USAGE);
    return;
  }
  if (!email) throw new AccountError(`--email is required.\n\n${USAGE}`);

  if (command === 'create') {
    if (!name) throw new AccountError(`--name is required.\n\n${USAGE}`);
    // Read the password before booting the app so the prompt isn't mixed with logs.
    const password = await readPassword(values['password-stdin']);
    await runWithAuthContext(async (ctx) => {
      const result = values.upsert
        ? await upsertAccount(ctx, { email, name, password })
        : { ...(await createAccount(ctx, { email, name, password })), created: true };
      process.stdout.write(
        `${result.created ? 'Created' : 'Updated the password for'} account ${email}.\n`,
      );
    });
  } else if (command === 'reset-password') {
    const password = await readPassword(values['password-stdin']);
    await runWithAuthContext(async (ctx) => {
      await resetPassword(ctx, { email, password });
      process.stdout.write(`Password reset for ${email}; existing sessions were signed out.\n`);
    });
  } else {
    throw new AccountError(`Unknown command "${command}".\n\n${USAGE}`);
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
