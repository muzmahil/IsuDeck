const readline = require('readline');

let counter = 0;
let defaultStep = 1;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

function send(payload) {
  process.stdout.write(JSON.stringify(payload) + '\n');
}

function broadcastCounterState() {
  send({
    op: 'state_update',
    plugin: 'com.isudeck.example.nodecounter',
    action: 'increment_counter',
    filter: {},
    exclusive: false,
    state: {
      active: true,
      badge: String(counter),
      badgeColor: counter > 0 ? '#22c55e' : (counter < 0 ? '#ef4444' : '#3b82f6'),
      borderColor: counter > 0 ? '#22c55e' : '#3b82f6'
    }
  });
}

rl.on('line', (line) => {
  const text = line.trim();
  if (!text) return;

  try {
    const msg = JSON.parse(text);
    const op = msg.op;
    const reqId = msg.requestId;

    if (op === 'init') {
      const cfg = msg.config || {};
      if (cfg.stepSize) {
        defaultStep = Number(cfg.stepSize) || 1;
      }
      broadcastCounterState();
    } 
    else if (op === 'execute') {
      const action = msg.action;
      const args = msg.args || {};

      if (action === 'increment_counter') {
        const step = args.amount ? Number(args.amount) : defaultStep;
        counter += step;

        send({
          op: 'execute_response',
          requestId: reqId,
          success: true,
          message: `Counter updated to ${counter}.`
        });

        broadcastCounterState();
      } 
      else if (action === 'reset_counter') {
        counter = 0;

        send({
          op: 'execute_response',
          requestId: reqId,
          success: true,
          message: 'Counter reset to 0.'
        });

        broadcastCounterState();
      }
    } 
    else if (op === 'get_data') {
      // Dynamic dropdown list request (dynamic_select)
      send({
        op: 'data_response',
        requestId: reqId,
        data: [
          { id: '1', label: '+1 Increment' },
          { id: '5', label: '+5 Increment' },
          { id: '10', label: '+10 Increment' }
        ]
      });
    }
  } catch (err) {
    // JSON parse error
  }
});
