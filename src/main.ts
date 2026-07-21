import { programmerGraph } from './programmer/index';
import { applyProviderEnv, readProviderConfig } from './config/provider';

async function main() {
  const repoPath = process.argv[2] ?? process.cwd();
  const query = process.argv[3] ?? 'Analyze the codebase and suggest improvements.';
  const providerConfig = await readProviderConfig(repoPath);
  applyProviderEnv(providerConfig);

  const programmerResult = await programmerGraph.invoke({
    query,
    repoPath,
    providerConfig,
    notes: '',
    messages: [],
    summary: '',
  }, { recursionLimit: 100 });

}

main().catch(console.error);
