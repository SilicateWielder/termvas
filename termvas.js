let inputHandler = require('input-handler');
//  - Changed termvas to be an extension of input-handler rather than EventHandler.
//  - Realigned cursor tracking to use the now-internal this.on method.

class termvas extends inputHandler {
    constructor(rendermouse = false) {
        super();

		process.stdout.write('\x1b[2J');

        this.renderMouse = rendermouse;
        this.cursorHidden = false;
        this.mouseX = 0;
        this.mouseY = 0;
        if (this.renderMouse) {
            this.on('mouse-move', (pos) => {
                //console.log(`Mouse moved to x:${pos.x}, y:${pos.y}`);
                // Coordinates get adjusted to match 0-indexing.
                this.mouseX = pos.x - 1;
                this.mouseY = pos.y - 1;
            });
        }

        this.fgMatrix = {
            'black': '30',
            'red': '31',
            'green': '32',
            'yellow': '33',
            'blue': '34',
            'magenta': '35',
            'cyan': '36',
            'white': '37',
            'default': '39',
        };

        this.bgMatrix = {
            'black': '40',
            'red': '41',
            'green': '42',
            'yellow': '43',
            'blue': '44',
            'magenta': '45',
            'cyan': '46',
            'white': '47',
            'default': '49',
        };

        this.defaultCell = { fg: 'default', bg: 'default', ch: ' ', wasCursor: false };

        this.width = process.stdout.columns;
        this.height = process.stdout.rows;

        this.updateBuffer = this.#initScreenBuffer(this.width, this.height);
        this.buffer = this.#initScreenBuffer(this.width, this.height);
        this.bufferUpdated = false;
    }

    // Initialize a screen buffer with default elements
    #initScreenBuffer(width, height, element = this.defaultCell) {
        let buffer = [];
        for (let h = 0; h < height; h++) {
            let row = [];
            for (let w = 0; w < width; w++) {
                row.push({ ...element });
            }
            buffer.push(row);
        }

        return buffer;
    }

    // Pushes updates to the relevant parts of the buffer.
    setChar(x, y, text, fg, bg) {
        let source = this.buffer[y][x];
        let ref = { ...source };

        if (ref.ch !== text) ref.ch = text;
        if (ref.fg !== fg && fg !== undefined && fg !== null) ref.fg = fg;
        if (ref.bg !== bg && bg !== undefined && bg !== null) ref.bg = bg;

        this.updateBuffer[y][x] = { ...ref };
        this.bufferUpdated = true;  // Mark buffer as updated
    }

    // Writes text to a specific portion of the buffer.
	writeText(x, y, text, fg = 'default', bg = 'default') {
		for(let c = 0; c < text.length; c++) {
			this.setChar(x + c, y, text[c], fg, bg);
		}
	}

    // Gets color code for foreground
    #getFgCode(fgColor) {

        return this.fgMatrix[fgColor];
    }

    // Gets color code for background.
    #getBgCode(bgColor) {
        return this.bgMatrix[bgColor];
    }

    // Renders the whole screen.
    render() {

        // Hide cursor and set up exit event.
        if (!this.cursorHidden) {
            process.stdout.write('\x1b[?25l'); // Hide cursor.
            this.cursorHidden = true;

            process.on('exit', (code) => {
                process.stdout.write('\x1b[?25h'); // Restore cursor.
            });

            process.on('SIGINT', (code) => {
                process.stdout.write('\x1b[?25h'); // Restore cursor.
            });
        }

        // Iterate through cells.
        for(let h = 0; h < this.height; h++) {
            let lastXPos = 0;
            let lastFg = null;
            let lastBg = null;

            for(let w = 0; w < this.width; w++) {
                let oldCell = this.buffer[h][w]; // Original cell.
                let newCell = this.updateBuffer[h][w]; // Mask to apply if different;

                //Check if the cell is not equal to the values of the defaultCell.
                let fgChanged = (this.defaultCell.fg !== newCell.fg);
                let bgChanged = (this.defaultCell.bg !== newCell.bg);
                let chChanged = (this.defaultCell.ch !== newCell.ch);

                // Simplification...
                let cellNeedsUpdate = (fgChanged || bgChanged || chChanged);
                let cellIsCursor = (this.mouseX === w) && (this.mouseY === h);
                let cellWasCursor = oldCell.wasCursor && !cellIsCursor;

                // Further simplification... *sigh*
                let drawCursor = cellIsCursor && this.renderMouse;
                let drawBuff = cellWasCursor && !cellNeedsUpdate;
                let drawNewCell = cellNeedsUpdate;

                // These we do need.
                let mustDraw = (drawCursor + drawBuff + drawNewCell);
                let madeJump = lastXPos !== w - 1;

                // Update the cursor position if we're writing and also making a jump.
                if(mustDraw && madeJump) {
                    lastXPos = w;
                    process.stdout.write(`\x1b[${h + 1};${w + 1}H`)
                }

                //TODO: Implement smart color changes.

                if (drawCursor) {
                    // We're just always going to assume this is a change. For now.
                    let fg = (lastFg !== 'white') ? `\x1b[${this.#getFgCode('white')}m` : '';
                    let bg = (lastBg !== 'white') ? `\x1b[${this.#getBgCode('white')}m` : '';
                    if (lastFg !== 'white') lastFg = 'white';
                    if (lastBg !== 'white') lastBg = 'white';

                    process.stdout.write(`\x1b[${this.#getFgCode('white')}m\x1b[${this.#getBgCode('white')}m `);
                    this.buffer[h][w].wasCursor = true;
                } else if (drawBuff) {
                    let fg = (lastFg !== oldCell.fg) ? `\x1b[${this.#getFgCode(oldCell.fg)}m` : '';
                    let bg = (lastBg !== oldCell.bg) ? `\x1b[${this.#getBgCode(oldCell.bg)}m` : '';

                    if (lastFg !== oldCell.fg) lastFg = oldCell.fg;
                    if (lastBg !== oldCell.bg) lastBg = oldCell.bg;

                    process.stdout.write(`${fg + bg}${oldCell.ch}`);
                    this.buffer[h][w].wasCursor = false;
                } else if (drawNewCell) {
                    this.buffer[h][w] = { ...this.updateBuffer[h][w] };

                    let fg = (lastFg !== this.buffer[h][w].fg) ? `\x1b[${this.#getFgCode(this.buffer[h][w].fg)}m` : '';
                    let bg = (lastBg !== this.buffer[h][w].bg) ? `\x1b[${this.#getBgCode(this.buffer[h][w].bg)}m` : '';
                    if (lastFg !== this.buffer[h][w].fg) lastFg = this.buffer[h][w].fg;
                    if (lastBg !== this.buffer[h][w].bg) lastBg = this.buffer[h][w].bg;

                    process.stdout.write(`${fg + bg}${this.buffer[h][w].ch}`);
                    this.updateBuffer[h][w] = { ...this.defaultCell };
                }               

                // For Reference.
                //process.stdout.write(`\x1b[${py};${px}H\x1b[${this.#getFgCode(fg)}m\x1b[${this.#getBgCode(bg)}m${ch}\x1b[0m`);
            }
            lastXPos = 6413607225; // Some dumb number to force a jump condition if we have to write right away.
        }

        process.stdout.write('\x1b[0m');
    }
}

// Simple test to ensure setChar and rendering is working as expected.
function selftest() {
    let testDisplay = new termvas(true);
    testDisplay.setChar(1, 1, 'H');
    testDisplay.setChar(1, 2, 'E');
    testDisplay.setChar(1, 3, 'L');
    testDisplay.setChar(1, 4, 'L');
    testDisplay.setChar(1, 5, 'O');

    testDisplay.setChar(3, 1, 'W');
    testDisplay.setChar(3, 2, 'O');
    testDisplay.setChar(3, 3, 'R');
    testDisplay.setChar(3, 4, 'L');
    testDisplay.setChar(3, 5, 'D');

    testDisplay.writeText(1, 6, 'HELLO', 'red');
    testDisplay.writeText(12, 6, 'WORLD', 'blue');

    setInterval(() => {
        // Special character to ensure characters are being overwritten.
        testDisplay.setChar(9, 4, '' + Math.floor(Math.random() * 9));
        testDisplay.writeText(9, 5, '' + testDisplay.mouseX + ' '.repeat(3));
        testDisplay.writeText(9, 6, '' + testDisplay.mouseY + ' '.repeat(3));
        testDisplay.render();
    }, 32);
}

//selftest();

module.exports = termvas