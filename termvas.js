let inputHandler = require('input-handler');
//  - Added check within render, to only progress if changes were made.
//  - Added flag to buffers to test if individual rows have been altered before rendering.

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

        this.updated = true;

        this.fgMatrix = {
            'black': '\x1b[30m',
            'red': '\x1b[31m',
            'green': '\x1b[32m',
            'yellow': '\x1b[33m',
            'blue': '\x1b[34m',
            'magenta': '\x1b[35m',
            'cyan': '\x1b[36m',
            'white': '\x1b[37m',
            'default': '\x1b[39m',
        };

        this.bgMatrix = {
            'black': '\x1b[40m',
            'red': '\x1b[41m',
            'green': '\x1b[42m',
            'yellow': '\x1b[43m',
            'blue': '\x1b[44m',
            'magenta': '\x1b[45m',
            'cyan': '\x1b[46m',
            'white': '\x1b[47m',
            'default': '\x1b[49m',
        };

        this.defaultCell = { fg: 'default', bg: 'default', ch: ' ', wasCursor: false };

        this.width = process.stdout.columns;
        this.height = process.stdout.rows;

        this.updateBuffer = this.#initScreenBuffer(this.width, this.height);
        this.updateRef = [];
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

    #getCell(x, y) {
        return this.buffer[y][x];
    }

    #getMaskCell(x, y) {
        return this.updateBuffer[y][x];
    }

    // Copies cell from updatebuffer to buffer before clearing the updatebuffer cell.
    #maskCell(x, y) {
        if(this.buffer[y][x] === undefined ) return;
        this.buffer[y][x] = { ...this.updateBuffer[y][x] };
        this.updateBuffer[y][x] = this.defaultCell;
    }

    #getFgString(color) {
        return this.fgMatrix[color];
    }

    #getBgString(color) {
        return this.bgMatrix[color];
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

        if(this.updated !== true) this.updated = true;
    }

    // Writes text to a specific portion of the buffer.
	writeText(x, y, text, fg = 'default', bg = 'default') {
		for(let c = 0; c < text.length; c++) {
			this.setChar(x + c, y, text[c], fg, bg);
		}
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

        let cursorRendered = false;

        if(this.updated === false) return;

        // Iterate through cells.
        for(let h = 0; h < this.height; h++) {
            let lastXPos = 0;
            let lastFg = null;
            let lastBg = null;

            for(let w = 0; w < this.width; w++) {
                let string = '';
                let oldCell = this.buffer[h][w]; // Original cell.
                let newCell = this.updateBuffer[h][w]; // Mask to apply if different;

                //Check if the cell is not equal to the values of the defaultCell.
                let fgChanged = (this.defaultCell.fg !== newCell.fg);
                let bgChanged = (this.defaultCell.bg !== newCell.bg);
                let chChanged = (this.defaultCell.ch !== newCell.ch);

                // Basic Checks
                let cellNeedsUpdate = (fgChanged || bgChanged || chChanged);
                let cellIsCursor = (this.mouseX === w) && (this.mouseY === h);

                // Final checks
                let drawCursor = cellIsCursor && this.renderMouse && !cursorRendered;
                let drawBuff = oldCell.wasCursor && !cellIsCursor && !cellNeedsUpdate;

                // Checks to determine if we're jumping around in the terminal.
                let mustDraw = (drawCursor || drawBuff || cellNeedsUpdate);
                let madeJump = lastXPos !== w - 1;

                // Update the cursor position if we're writing and also making a jump.
                if(mustDraw && madeJump) {
                    lastXPos = w;
                    string += (`\x1b[${h + 1};${w + 1}H`)
                }

                //TODO: Implement smart color changes.

                if (drawCursor) {
                    // We're just always going to assume this is a change. For now.
                    let fg = (lastFg !== 'white') ? (lastFg = 'white', this.#getFgString('white')) : '';
                    let bg = (lastBg !== 'white') ? (lastBg = 'white', this.#getBgString('white')) : '';

                    string += (`${fg + bg}${oldCell.ch}`);
                    this.buffer[h][w].wasCursor = true;
                } else if (drawBuff) {
                    let fg = (lastFg !== oldCell.fg) ? (lastFg = oldCell.fg, this.#getFgString(oldCell.fg)) : '';
                    let bg = (lastBg !== oldCell.bg) ? (lastBg = oldCell.bg, this.#getBgString(oldCell.bg)) : '';

                    string += (`${fg + bg}${oldCell.ch}`);
                    this.buffer[h][w].wasCursor = false;
                } else if (cellNeedsUpdate) {
                    let fg = (lastFg !== newCell.fg) ? (lastFg = newCell.fg, this.#getFgString(newCell.fg)) : '';
                    let bg = (lastBg !== newCell.bg) ? (lastBg = newCell.bg, this.#getBgString(newCell.bg)) : '';

                    string += (`${fg + bg}${this.buffer[h][w].ch}`);
                    this.#maskCell(w, h)
                }               

                if(string !== '' ) process.stdout.write(string);
            }
            process.stdout.write('\x1b[0m');
            lastXPos = 6413607225; // Some dumb number to force a jump condition if we have to write right away.
        }

        this.updated = false;
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
