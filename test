const { spawn } = require('child_process');

const PORT = 6969;

const server = spawn(process.execPath, ['server.js'], {
  env: {
    ...process.env,
    PORT: String(PORT),
    NODE_ENV: 'test'
  },
  stdio: ['ignore', 'pipe', 'pipe']
});

let output = '';

server.stdout.on('data', (data) => {
  output += data.toString();
});

server.stderr.on('data', (data) => {
  output += data.toString();
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTest() {
  try {
    await sleep(1500);

    const response = await fetch(`http://127.0.0.1:${PORT}/api/health`);
    const data = await response.json();

    if (!response.ok || data.ok !== true) {
      throw new Error('Endpoint /api/health não retornou sucesso.');
    }

    console.log('✅ API respondeu corretamente.');
    console.log(data);

    server.kill();
    process.exit(0);
  } catch (error) {
    console.error('❌ Teste da API falhou.');
    console.error(error.message);
    console.error(output);

    server.kill();
    process.exit(1);
  }
}

runTest();
