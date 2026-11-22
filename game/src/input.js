// Input: keyboard state with edge detection, plus mouse position and clicks.

export function createInput(canvas) {
  const keys = new Set();
  const pressedQueue = new Set();
  const mouse = { x: 0, y: 0, clicked: false, clickX: 0, clickY: 0 };

  const KEYMAP = {
    KeyW: 'up', ArrowUp: 'up',
    KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
    ShiftLeft: 'sneak', ShiftRight: 'sneak',
    KeyE: 'interact',
    KeyQ: 'smoke',
    KeyR: 'emp',
    KeyP: 'pause',
    KeyM: 'mute',
    Enter: 'confirm',
    Escape: 'escape',
  };

  function toCanvas(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  window.addEventListener('keydown', (e) => {
    const action = KEYMAP[e.code];
    if (action) {
      if (!keys.has(action)) pressedQueue.add(action);
      keys.add(action);
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => {
    const action = KEYMAP[e.code];
    if (action) keys.delete(action);
  });
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousemove', (e) => {
    const p = toCanvas(e);
    mouse.x = p.x;
    mouse.y = p.y;
  });
  canvas.addEventListener('mousedown', (e) => {
    const p = toCanvas(e);
    mouse.x = p.x;
    mouse.y = p.y;
    mouse.clicked = true;
    mouse.clickX = p.x;
    mouse.clickY = p.y;
  });

  return {
    isDown(action) { return keys.has(action); },
    wasPressed(action) { return pressedQueue.has(action); },
    consumeClick() {
      if (!mouse.clicked) return null;
      mouse.clicked = false;
      return { x: mouse.clickX, y: mouse.clickY };
    },
    mouse,
    endFrame() { pressedQueue.clear(); },
  };
}
